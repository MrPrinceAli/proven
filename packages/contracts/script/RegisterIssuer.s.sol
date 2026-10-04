// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {IssuerRegistry} from "../src/IssuerRegistry.sol";

contract RegisterIssuer is Script {
    function run() external {
        address registry = vm.envAddress("ISSUER_REGISTRY_ADDRESS");
        address issuer = vm.envAddress("ISSUER_ADDRESS");
        bytes32 nameHash = keccak256(abi.encodePacked(vm.envString("ISSUER_NAME")));
        bytes32 didHash = keccak256(abi.encodePacked(vm.envString("ISSUER_DID")));
        uint256 pk = vm.envUint("DEPLOYER_PRIVATE_KEY");

        vm.startBroadcast(pk);
        IssuerRegistry(registry).register(issuer, nameHash, didHash);
        vm.stopBroadcast();

        console.log("Issuer registered:", issuer);
    }
}
