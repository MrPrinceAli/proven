// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

interface IIssuerRegistry {
    function isActive(address issuer) external view returns (bool);
}

/// @notice Anchor hash kredensial + status revocation.
/// credentialHash = sha256(JCS(vc tanpa proof)); subjectRef = sha256(DID subject).
contract CredentialRegistry is AccessControl {
    IIssuerRegistry public immutable issuerRegistry;

    struct Anchor {
        bytes32 credentialHash;
        bytes32 subjectRef;
        address issuer;
        uint64 issuedAt;
        bool revoked;
    }

    mapping(bytes32 => Anchor) private _anchors;

    event CredentialIssued(
        bytes32 indexed credentialHash,
        bytes32 indexed subjectRef,
        address indexed issuer,
        uint64 issuedAt
    );
    event CredentialRevoked(bytes32 indexed credentialHash, address indexed by, uint64 revokedAt);

    constructor(address admin, address issuerRegistry_) {
        require(admin != address(0) && issuerRegistry_ != address(0), "ZERO_ADDR");
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        issuerRegistry = IIssuerRegistry(issuerRegistry_);
    }

    modifier onlyActiveIssuer() {
        require(issuerRegistry.isActive(msg.sender), "NOT_ACTIVE_ISSUER");
        _;
    }

    function issue(bytes32 credentialHash, bytes32 subjectRef) external onlyActiveIssuer {
        require(credentialHash != bytes32(0) && subjectRef != bytes32(0), "ZERO_HASH");
        require(_anchors[credentialHash].credentialHash == bytes32(0), "EXISTS");
        uint64 ts = uint64(block.timestamp);
        _anchors[credentialHash] = Anchor(credentialHash, subjectRef, msg.sender, ts, false);
        emit CredentialIssued(credentialHash, subjectRef, msg.sender, ts);
    }

    /// @dev Issuer penerbit tetap boleh mencabut kredensialnya walau sudah di-deactivate; admin selalu boleh.
    function revoke(bytes32 credentialHash) external {
        Anchor storage a = _anchors[credentialHash];
        require(a.credentialHash != bytes32(0), "NOT_FOUND");
        require(a.issuer == msg.sender || hasRole(DEFAULT_ADMIN_ROLE, msg.sender), "NOT_ISSUER");
        require(!a.revoked, "ALREADY_REVOKED");
        a.revoked = true;
        emit CredentialRevoked(credentialHash, msg.sender, uint64(block.timestamp));
    }

    function isRevoked(bytes32 credentialHash) external view returns (bool) {
        return _anchors[credentialHash].revoked;
    }

    function getAnchor(bytes32 credentialHash)
        external
        view
        returns (bytes32, bytes32, address, uint64, bool)
    {
        Anchor memory a = _anchors[credentialHash];
        return (a.credentialHash, a.subjectRef, a.issuer, a.issuedAt, a.revoked);
    }
}
