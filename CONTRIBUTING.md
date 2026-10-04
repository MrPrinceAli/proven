# Contributing to Proven-ID

Thanks for helping make professional claims provable! 💚

## Ground rules

Every change must respect the [golden rules](README.md#-golden-rules). The short version:

- **No personal data on-chain.** Contracts only store `bytes32`, `address`, `uint` and `bool`.
- **AI never invents** skills or experience, and it never marks anything as verified.
- **Private keys stay on the server.** Never commit `.env` or put secrets in `NEXT_PUBLIC_*`.
- Hash credentials with the utilities in `packages/vc`. Don't re-implement them.

## Workflow

1. Fork the repo, or create a branch if you're a collaborator: `feat-…`, `fix-…`, `docs-…`.
2. Make your change and add tests. Every feature needs tests, and coverage stays ≥ 70% for services and contracts.
3. Run the gates:
   ```bash
   pnpm lint && pnpm typecheck && pnpm test
   pnpm test:contracts   # when touching packages/contracts
   pnpm e2e              # when touching user flows (needs Postgres + Anvil)
   ```
4. Open a pull request against `main`. CI (lint, typecheck, tests with Postgres + Anvil, Foundry, Playwright) must be green.
5. Record any non-obvious architecture choice in [`docs/DECISIONS.md`](docs/DECISIONS.md).

## Conventions

- TypeScript everywhere. Validate every boundary with Zod. Validate env at startup.
- API errors use RFC 9457 (`application/problem+json`). Times are ISO 8601 UTC.
- Authorization is deny-by-default with object-level checks. Sensitive mutations write to `audit_logs`.
- Addresses are EIP-55. A DID is `did:ethr:{chainId}:{address.toLowerCase()}`.
- UI copy is in Bahasa Indonesia (technical terms may stay in English). Aim for WCAG 2.2 AA.
- Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `docs:` …).

## Reporting bugs and ideas

Use the issue templates. For anything security-related, follow [SECURITY.md](SECURITY.md) instead of opening a public issue.
