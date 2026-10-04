# Proven

> **Anyone can claim a skill. Proven lets you prove it.**

Proven mengubah klaim profesional (skill, pengalaman, proyek, prestasi, komunitas) menjadi kredensial yang bisa
diverifikasi siapa saja: **CLAIM → EVIDENCE → VERIFICATION → CREDENTIAL + PROOF → PROVEN**.
Dibangun untuk BNB Hackathon (Indonesia Web3 Hackathon Bali, track Consumer Apps).

Rencana kerja & spesifikasi lengkap: [`docs/PROVEN-WAVES.md`](docs/PROVEN-WAVES.md) · keputusan: [`docs/DECISIONS.md`](docs/DECISIONS.md) · progres: [`docs/PROGRESS.md`](docs/PROGRESS.md).

## Arsitektur (full cloud, tanpa Docker)

| Bagian     | Layanan                                                                          |
| ---------- | -------------------------------------------------------------------------------- |
| Kode & CI  | GitHub + GitHub Actions (Postgres & Anvil jalan di runner CI)                    |
| Web + API  | Vercel, satu project (`apps/web`). API Fastify (`apps/api`) dilayani di `/api/*` |
| Database   | Neon Postgres (branch otomatis per preview)                                      |
| Blockchain | BSC Testnet (chainId 97)                                                         |

```
apps/web        Next.js 14 — UI user, issuer, verifier + route /api/[...path]
apps/api        Fastify 4 — buildApp() + createWebHandler() untuk Next.js
packages/vc     VC toolkit (W4)        packages/ai   LLM + guardrail (W6)
packages/db     Prisma (W2)            packages/ui   design system "Ledger & Seal"
packages/contracts  Foundry (W1)
```

## Alur kerja

1. Setiap gelombang dikerjakan di branch `wN-*` lalu dibuka PR.
2. GitHub Actions menjalankan format check, lint, typecheck, test, dan build.
3. Vercel membuat URL preview untuk PR tersebut — cek dari browser, lalu merge.

## Pengembangan lokal (opsional)

Tidak wajib — semua bisa dicek lewat CI dan preview Vercel. Jika ingin menjalankan di laptop:

- Node 22 (`.nvmrc`) dan pnpm 9 (`corepack enable` atau `corepack pnpm …`)
- Foundry hanya dibutuhkan untuk menyentuh `packages/contracts`

```bash
pnpm install
pnpm dev        # web http://localhost:3000, API di http://localhost:3000/api/health
pnpm lint && pnpm typecheck && pnpm test && pnpm build
```

Rahasia tidak pernah disimpan di repo atau laptop: isi di Vercel Environment Variables dan GitHub Secrets
(daftar variabel: [`.env.example`](.env.example), lokasi tiap rahasia: `docs/PROVEN-WAVES.md` §S12.3).
