// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {IAccessControl} from "@openzeppelin/contracts/access/IAccessControl.sol";
import {IssuerRegistry} from "../src/IssuerRegistry.sol";

contract IssuerRegistryTest is Test {
    event IssuerRegistered(address indexed issuer, bytes32 nameHash, bytes32 didHash);
    event IssuerDeactivated(address indexed issuer);

    IssuerRegistry internal registry;
    address internal admin = makeAddr("admin");
    address internal issuer = makeAddr("issuer");
    address internal rando = makeAddr("rando");

    bytes32 internal constant NAME_HASH = keccak256("XYZ Community");
    bytes32 internal constant DID_HASH = keccak256("did:ethr:31337:0xissuer");

    function setUp() public {
        registry = new IssuerRegistry(admin);
    }

    function test_ConstructorRevertsOnZeroAdmin() public {
        vm.expectRevert(bytes("ZERO_ADDR"));
        new IssuerRegistry(address(0));
    }

    function test_AdminHasDefaultAdminRole() public view {
        assertTrue(registry.hasRole(registry.DEFAULT_ADMIN_ROLE(), admin));
    }

    function test_RegisterByAdmin() public {
        vm.expectEmit(true, false, false, true, address(registry));
        emit IssuerRegistered(issuer, NAME_HASH, DID_HASH);

        vm.prank(admin);
        registry.register(issuer, NAME_HASH, DID_HASH);

        assertTrue(registry.isActive(issuer));
        assertTrue(registry.hasRole(registry.ISSUER_ROLE(), issuer));
        (bytes32 nameHash, bytes32 didHash, bool active) = registry.issuers(issuer);
        assertEq(nameHash, NAME_HASH);
        assertEq(didHash, DID_HASH);
        assertTrue(active);
    }

    function test_RegisterRevertsForNonAdmin() public {
        vm.expectRevert(
            abi.encodeWithSelector(
                IAccessControl.AccessControlUnauthorizedAccount.selector, rando, registry.DEFAULT_ADMIN_ROLE()
            )
        );
        vm.prank(rando);
        registry.register(issuer, NAME_HASH, DID_HASH);
    }

    function test_RegisterRevertsOnZeroAddress() public {
        vm.expectRevert(bytes("ZERO_ADDR"));
        vm.prank(admin);
        registry.register(address(0), NAME_HASH, DID_HASH);
    }

    function test_DeactivateByAdmin() public {
        vm.startPrank(admin);
        registry.register(issuer, NAME_HASH, DID_HASH);

        vm.expectEmit(true, false, false, false, address(registry));
        emit IssuerDeactivated(issuer);
        registry.deactivate(issuer);
        vm.stopPrank();

        assertFalse(registry.isActive(issuer));
        assertFalse(registry.hasRole(registry.ISSUER_ROLE(), issuer));
    }

    function test_DeactivateRevertsForNonAdmin() public {
        vm.prank(admin);
        registry.register(issuer, NAME_HASH, DID_HASH);

        vm.expectRevert(
            abi.encodeWithSelector(
                IAccessControl.AccessControlUnauthorizedAccount.selector, rando, registry.DEFAULT_ADMIN_ROLE()
            )
        );
        vm.prank(rando);
        registry.deactivate(issuer);
    }

    function test_DeactivateRevertsWhenNotActive() public {
        vm.expectRevert(bytes("NOT_ACTIVE"));
        vm.prank(admin);
        registry.deactivate(issuer);
    }

    function test_IsActiveFalseForUnknownAddress() public view {
        assertFalse(registry.isActive(rando));
    }

    function test_ReRegisterAfterDeactivate() public {
        vm.startPrank(admin);
        registry.register(issuer, NAME_HASH, DID_HASH);
        registry.deactivate(issuer);
        registry.register(issuer, NAME_HASH, DID_HASH);
        vm.stopPrank();

        assertTrue(registry.isActive(issuer));
    }
}
