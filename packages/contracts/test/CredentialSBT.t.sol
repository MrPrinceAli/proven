// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {IAccessControl} from "@openzeppelin/contracts/access/IAccessControl.sol";
import {IERC721Errors} from "@openzeppelin/contracts/interfaces/draft-IERC6093.sol";
import {CredentialSBT} from "../src/CredentialSBT.sol";

contract CredentialSBTTest is Test {
    event Locked(uint256 tokenId);

    CredentialSBT internal sbt;
    address internal admin = makeAddr("admin");
    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");

    // keccak256, not sha256: a sha256 constant is a precompile call and would consume vm.prank.
    uint256 internal constant TOKEN = uint256(keccak256("vc-without-proof"));

    function setUp() public {
        sbt = new CredentialSBT("Proven Credential", "PROVEN", admin);
    }

    function _mintToAlice() internal {
        vm.prank(admin);
        sbt.mint(alice, TOKEN);
    }

    function test_ConstructorRevertsOnZeroAdmin() public {
        vm.expectRevert(bytes("ZERO_ADDR"));
        new CredentialSBT("Proven Credential", "PROVEN", address(0));
    }

    function test_MintByMinterEmitsLocked() public {
        vm.expectEmit(false, false, false, true, address(sbt));
        emit Locked(TOKEN);
        _mintToAlice();

        assertEq(sbt.ownerOf(TOKEN), alice);
        assertTrue(sbt.locked(TOKEN));
    }

    function test_MintRevertsForNonMinter() public {
        vm.expectRevert(
            abi.encodeWithSelector(IAccessControl.AccessControlUnauthorizedAccount.selector, bob, sbt.MINTER_ROLE())
        );
        vm.prank(bob);
        sbt.mint(bob, TOKEN);
    }

    function test_TransferFromReverts() public {
        _mintToAlice();
        vm.expectRevert(bytes("SOULBOUND"));
        vm.prank(alice);
        sbt.transferFrom(alice, bob, TOKEN);
    }

    function test_SafeTransferFromReverts() public {
        _mintToAlice();
        vm.expectRevert(bytes("SOULBOUND"));
        vm.prank(alice);
        sbt.safeTransferFrom(alice, bob, TOKEN);
    }

    function test_SafeTransferFromWithDataReverts() public {
        _mintToAlice();
        vm.expectRevert(bytes("SOULBOUND"));
        vm.prank(alice);
        sbt.safeTransferFrom(alice, bob, TOKEN, "");
    }

    function test_ApproveReverts() public {
        _mintToAlice();
        vm.expectRevert(bytes("SOULBOUND"));
        vm.prank(alice);
        sbt.approve(bob, TOKEN);
    }

    function test_SetApprovalForAllReverts() public {
        vm.expectRevert(bytes("SOULBOUND"));
        vm.prank(alice);
        sbt.setApprovalForAll(bob, true);
    }

    function test_LockedRevertsForNonexistentToken() public {
        vm.expectRevert(abi.encodeWithSelector(IERC721Errors.ERC721NonexistentToken.selector, TOKEN));
        sbt.locked(TOKEN);
    }

    function test_SupportsInterfaces() public view {
        assertTrue(sbt.supportsInterface(0xb45a3c0e), "ERC-5192");
        assertTrue(sbt.supportsInterface(0x80ac58cd), "ERC-721");
        assertTrue(sbt.supportsInterface(0x7965db0b), "AccessControl");
        assertFalse(sbt.supportsInterface(0xffffffff));
    }

    function test_BurnByOwner() public {
        _mintToAlice();
        vm.prank(alice);
        sbt.burn(TOKEN);

        vm.expectRevert(abi.encodeWithSelector(IERC721Errors.ERC721NonexistentToken.selector, TOKEN));
        sbt.ownerOf(TOKEN);
    }

    function test_BurnByMinter() public {
        _mintToAlice();
        vm.prank(admin);
        sbt.burn(TOKEN);
        assertEq(sbt.balanceOf(alice), 0);
    }

    function test_BurnRevertsForStranger() public {
        _mintToAlice();
        vm.expectRevert(bytes("NOT_AUTHORIZED"));
        vm.prank(bob);
        sbt.burn(TOKEN);
    }
}
