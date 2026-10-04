// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {IssuerRegistry} from "../src/IssuerRegistry.sol";
import {CredentialRegistry} from "../src/CredentialRegistry.sol";
import {CredentialSBT} from "../src/CredentialSBT.sol";

contract DeployProven is Script {
    function run() external {
        uint256 pk = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address admin = vm.addr(pk);

        vm.startBroadcast(pk);
        IssuerRegistry issuerRegistry = new IssuerRegistry(admin);
        CredentialRegistry credentialRegistry = new CredentialRegistry(admin, address(issuerRegistry));
        CredentialSBT credentialSBT = new CredentialSBT("Proven Credential", "PROVEN", admin);
        vm.stopBroadcast();

        console.log("ISSUER_REGISTRY_ADDRESS=", address(issuerRegistry));
        console.log("REGISTRY_ADDRESS=", address(credentialRegistry));
        console.log("CREDENTIAL_SBT_ADDRESS=", address(credentialSBT));

        string memory obj = "deployment";
        vm.serializeUint(obj, "chainId", block.chainid);
        vm.serializeAddress(obj, "issuerRegistry", address(issuerRegistry));
        vm.serializeAddress(obj, "credentialRegistry", address(credentialRegistry));
        string memory json = vm.serializeAddress(obj, "credentialSBT", address(credentialSBT));
        vm.writeJson(json, string.concat("./deployments/", vm.toString(block.chainid), ".json"));
    }
}
