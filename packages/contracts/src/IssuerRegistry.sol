// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

/// @notice Registrasi issuer (address <-> nameHash <-> didHash). Tanpa PII.
contract IssuerRegistry is AccessControl {
    bytes32 public constant ISSUER_ROLE = keccak256("ISSUER_ROLE");

    struct Issuer {
        bytes32 nameHash; // keccak256(abi.encodePacked(name))
        bytes32 didHash;  // keccak256(abi.encodePacked(did))
        bool active;
    }

    mapping(address => Issuer) public issuers;

    event IssuerRegistered(address indexed issuer, bytes32 nameHash, bytes32 didHash);
    event IssuerDeactivated(address indexed issuer);

    constructor(address admin) {
        require(admin != address(0), "ZERO_ADDR");
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    function register(address issuer, bytes32 nameHash, bytes32 didHash)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        require(issuer != address(0), "ZERO_ADDR");
        issuers[issuer] = Issuer(nameHash, didHash, true);
        _grantRole(ISSUER_ROLE, issuer);
        emit IssuerRegistered(issuer, nameHash, didHash);
    }

    function deactivate(address issuer) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(issuers[issuer].active, "NOT_ACTIVE");
        issuers[issuer].active = false;
        _revokeRole(ISSUER_ROLE, issuer);
        emit IssuerDeactivated(issuer);
    }

    function isActive(address issuer) external view returns (bool) {
        return issuers[issuer].active;
    }
}
