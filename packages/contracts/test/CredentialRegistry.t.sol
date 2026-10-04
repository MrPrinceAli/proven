// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {IssuerRegistry} from "../src/IssuerRegistry.sol";
import {CredentialRegistry} from "../src/CredentialRegistry.sol";

contract CredentialRegistryTest is Test {
    event CredentialIssued(
        bytes32 indexed credentialHash, bytes32 indexed subjectRef, address indexed issuer, uint64 issuedAt
    );
    event CredentialRevoked(bytes32 indexed credentialHash, address indexed by, uint64 revokedAt);

    IssuerRegistry internal issuers;
    CredentialRegistry internal registry;

    address internal admin = makeAddr("admin");
    address internal issuer = makeAddr("issuer");
    address internal otherIssuer = makeAddr("otherIssuer");
    address internal rando = makeAddr("rando");

    // keccak256, not sha256: a sha256 constant is a precompile call and would consume vm.prank.
    bytes32 internal constant HASH = keccak256("vc-without-proof");
    bytes32 internal constant SUBJECT = keccak256("did:ethr:31337:0xsubject");

    function setUp() public {
        issuers = new IssuerRegistry(admin);
        registry = new CredentialRegistry(admin, address(issuers));

        vm.startPrank(admin);
        issuers.register(issuer, keccak256("XYZ Community"), keccak256("did:ethr:31337:0xissuer"));
        issuers.register(otherIssuer, keccak256("Other"), keccak256("did:ethr:31337:0xother"));
        vm.stopPrank();
    }

    function _issue() internal {
        vm.prank(issuer);
        registry.issue(HASH, SUBJECT);
    }

    // ----- constructor -----

    function test_ConstructorRevertsOnZeroAdmin() public {
        vm.expectRevert(bytes("ZERO_ADDR"));
        new CredentialRegistry(address(0), address(issuers));
    }

    function test_ConstructorRevertsOnZeroIssuerRegistry() public {
        vm.expectRevert(bytes("ZERO_ADDR"));
        new CredentialRegistry(admin, address(0));
    }

    function test_ConstructorWiresIssuerRegistry() public view {
        assertEq(address(registry.issuerRegistry()), address(issuers));
        assertTrue(registry.hasRole(registry.DEFAULT_ADMIN_ROLE(), admin));
    }

    // ----- issue -----

    function test_IssueByActiveIssuer() public {
        vm.warp(1_700_000_000);
        vm.expectEmit(true, true, true, true, address(registry));
        emit CredentialIssued(HASH, SUBJECT, issuer, 1_700_000_000);

        _issue();

        (bytes32 h, bytes32 s, address by, uint64 issuedAt, bool revoked) = registry.getAnchor(HASH);
        assertEq(h, HASH);
        assertEq(s, SUBJECT);
        assertEq(by, issuer);
        assertEq(issuedAt, 1_700_000_000);
        assertFalse(revoked);
        assertFalse(registry.isRevoked(HASH));
    }

    function test_IssueRevertsForNonIssuer() public {
        vm.expectRevert(bytes("NOT_ACTIVE_ISSUER"));
        vm.prank(rando);
        registry.issue(HASH, SUBJECT);
    }

    function test_IssueRevertsForAdminWhoIsNotIssuer() public {
        vm.expectRevert(bytes("NOT_ACTIVE_ISSUER"));
        vm.prank(admin);
        registry.issue(HASH, SUBJECT);
    }

    function test_IssueRevertsForDeactivatedIssuer() public {
        vm.prank(admin);
        issuers.deactivate(issuer);

        vm.expectRevert(bytes("NOT_ACTIVE_ISSUER"));
        vm.prank(issuer);
        registry.issue(HASH, SUBJECT);
    }

    function test_IssueRevertsOnDuplicate() public {
        _issue();
        vm.expectRevert(bytes("EXISTS"));
        vm.prank(otherIssuer);
        registry.issue(HASH, SUBJECT);
    }

    function test_IssueRevertsOnZeroCredentialHash() public {
        vm.expectRevert(bytes("ZERO_HASH"));
        vm.prank(issuer);
        registry.issue(bytes32(0), SUBJECT);
    }

    function test_IssueRevertsOnZeroSubjectRef() public {
        vm.expectRevert(bytes("ZERO_HASH"));
        vm.prank(issuer);
        registry.issue(HASH, bytes32(0));
    }

    // ----- revoke -----

    function test_RevokeByIssuingIssuer() public {
        _issue();
        vm.warp(1_800_000_000);
        vm.expectEmit(true, true, false, true, address(registry));
        emit CredentialRevoked(HASH, issuer, 1_800_000_000);

        vm.prank(issuer);
        registry.revoke(HASH);

        assertTrue(registry.isRevoked(HASH));
        (,,,, bool revoked) = registry.getAnchor(HASH);
        assertTrue(revoked);
    }

    function test_RevokeByAdmin() public {
        _issue();
        vm.expectEmit(true, true, false, false, address(registry));
        emit CredentialRevoked(HASH, admin, 0);

        vm.prank(admin);
        registry.revoke(HASH);

        assertTrue(registry.isRevoked(HASH));
    }

    function test_RevokeByDeactivatedIssuerStillAllowed() public {
        _issue();
        vm.prank(admin);
        issuers.deactivate(issuer);

        vm.prank(issuer);
        registry.revoke(HASH);
        assertTrue(registry.isRevoked(HASH));
    }

    function test_RevokeRevertsForOtherIssuer() public {
        _issue();
        vm.expectRevert(bytes("NOT_ISSUER"));
        vm.prank(otherIssuer);
        registry.revoke(HASH);
    }

    function test_RevokeRevertsForRandom() public {
        _issue();
        vm.expectRevert(bytes("NOT_ISSUER"));
        vm.prank(rando);
        registry.revoke(HASH);
    }

    function test_RevokeRevertsWhenAlreadyRevoked() public {
        _issue();
        vm.startPrank(issuer);
        registry.revoke(HASH);
        vm.expectRevert(bytes("ALREADY_REVOKED"));
        registry.revoke(HASH);
        vm.stopPrank();
    }

    function test_RevokeRevertsForUnknownHash() public {
        vm.expectRevert(bytes("NOT_FOUND"));
        vm.prank(admin);
        registry.revoke(HASH);
    }

    // ----- views -----

    function test_UnknownHashIsEmptyAndNotRevoked() public view {
        (bytes32 h, bytes32 s, address by, uint64 issuedAt, bool revoked) = registry.getAnchor(HASH);
        assertEq(h, bytes32(0));
        assertEq(s, bytes32(0));
        assertEq(by, address(0));
        assertEq(issuedAt, 0);
        assertFalse(revoked);
        assertFalse(registry.isRevoked(HASH));
    }

    // ----- fuzz -----

    function testFuzz_IssueThenRevoke(bytes32 credentialHash, bytes32 subjectRef, uint64 issuedAt) public {
        vm.assume(credentialHash != bytes32(0) && subjectRef != bytes32(0));
        vm.warp(issuedAt);

        vm.prank(issuer);
        registry.issue(credentialHash, subjectRef);

        (bytes32 h, bytes32 s, address by, uint64 ts, bool revoked) = registry.getAnchor(credentialHash);
        assertEq(h, credentialHash);
        assertEq(s, subjectRef);
        assertEq(by, issuer);
        assertEq(ts, issuedAt);
        assertFalse(revoked);

        vm.prank(issuer);
        registry.revoke(credentialHash);
        assertTrue(registry.isRevoked(credentialHash));
    }

    function testFuzz_OnlyIssuingIssuerOrAdminCanRevoke(address caller) public {
        vm.assume(caller != issuer && caller != admin);
        _issue();

        vm.expectRevert(bytes("NOT_ISSUER"));
        vm.prank(caller);
        registry.revoke(HASH);
    }
}
