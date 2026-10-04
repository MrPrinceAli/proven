# Security Policy

Proven-ID is a hackathon project running on **BNB Smart Chain Testnet**. It holds no real funds, but we take
credential integrity and privacy seriously.

## Reporting a vulnerability

Please **do not open a public issue**. Report privately through
[GitHub Security Advisories](https://github.com/MrPrinceAli/proven/security/advisories/new).

Include:

- what you found and where (file, route or contract),
- how to reproduce it,
- the impact you expect (forged credential, PII leak, auth bypass, …).

We aim to reply within 72 hours.

## In scope

- Forging, replaying or tampering with credentials, or making a revoked credential verify as active
- Personal data leaking on-chain or through public endpoints
- Authentication / authorization bypass (SIWE sessions, issuer-only actions, demo-mode scoping)
- Access to another user's evidence files

## Design notes

- Contracts store only hashes, addresses and flags. There is no PII on-chain.
- Evidence is encrypted at rest (AES-256-GCM) and has a SHA-256 chain of custody.
- Issuer keys live only in server-side environment variables.
