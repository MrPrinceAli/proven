// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";

/// @notice Golden rule #1: the registries never accept or emit dynamic data (string/bytes) that could carry PII.
/// Every function, event, error and constructor input must be one of bytes32, bytes4, address, uintN or bool.
contract NoPIITest is Test {
    function test_IssuerRegistryAbiHasNoDynamicInputs() public view {
        _assertAbiInputsAllowed("out/IssuerRegistry.sol/IssuerRegistry.json");
    }

    function test_CredentialRegistryAbiHasNoDynamicInputs() public view {
        _assertAbiInputsAllowed("out/CredentialRegistry.sol/CredentialRegistry.json");
    }

    function test_AllowlistRejectsDynamicTypes() public pure {
        assertFalse(_isAllowed("string"));
        assertFalse(_isAllowed("bytes"));
        assertFalse(_isAllowed("string[]"));
        assertFalse(_isAllowed("uint256[]"));
        assertFalse(_isAllowed("tuple"));
        assertTrue(_isAllowed("uint64"));
        assertTrue(_isAllowed("bytes32"));
    }

    function _assertAbiInputsAllowed(string memory path) internal view {
        string memory json = vm.readFile(path);
        uint256 checked;
        for (uint256 i = 0; vm.keyExistsJson(json, _entry(i)); i++) {
            for (uint256 j = 0; vm.keyExistsJson(json, _input(i, j)); j++) {
                string memory t = vm.parseJsonString(json, string.concat(_input(i, j), ".type"));
                assertTrue(_isAllowed(t), string.concat(path, ": disallowed input type ", t));
                checked++;
            }
        }
        assertGt(checked, 0, "ABI has no inputs; path is wrong");
    }

    function _entry(uint256 i) internal pure returns (string memory) {
        return string.concat("$.abi[", vm.toString(i), "]");
    }

    function _input(uint256 i, uint256 j) internal pure returns (string memory) {
        return string.concat(_entry(i), ".inputs[", vm.toString(j), "]");
    }

    function _isAllowed(string memory t) internal pure returns (bool) {
        bytes32 h = keccak256(bytes(t));
        if (h == keccak256("bytes32") || h == keccak256("bytes4") || h == keccak256("address") || h == keccak256("bool"))
        {
            return true;
        }
        // uint8 .. uint256, but never arrays.
        bytes memory b = bytes(t);
        if (b.length < 5 || b.length > 7) return false;
        if (b[0] != "u" || b[1] != "i" || b[2] != "n" || b[3] != "t") return false;
        for (uint256 i = 4; i < b.length; i++) {
            if (b[i] < "0" || b[i] > "9") return false;
        }
        return true;
    }
}
