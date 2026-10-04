# Proven

> **Anyone can claim a skill. Proven lets you prove it.**

Proven mengubah klaim profesional (skill, pengalaman, proyek, prestasi, komunitas) menjadi kredensial yang bisa
diverifikasi siapa saja: **CLAIM → EVIDENCE → VERIFICATION → CREDENTIAL + PROOF → PROVEN**.
Dibangun untuk BNB Hackathon (Indonesia Web3 Hackathon, track Consumer Apps).

- **Demo:** https://proven-id.vercel.app · verifikasi: `/verify` · profil contoh: `/p/rina-demo`
- **Dokumen:** [rencana & spesifikasi](docs/PROVEN-WAVES.md) · [keputusan](docs/DECISIONS.md) · [progres](docs/PROGRESS.md) ·
  [deploy BSC Testnet](docs/DEPLOY-BSC-TESTNET.md) · [naskah demo](docs/DEMO-SCRIPT.md)

## Cara kerja

| Langkah    | Yang terjadi                                                                                                                                                                                                                        |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Login**  | Sign-In with Ethereum (EIP-4361): tanda tangan gratis, nonce sekali pakai, sesi cookie HttpOnly. Identitas `did:ethr:97:<address>`.                                                                                                 |
| **Create** | User mengisi profil ala LinkedIn dan mengunggah bukti (PDF/PNG/JPG ≤ 4 MB). SHA-256 dicatat, file dienkripsi AES-256-GCM, chain of custody diaudit.                                                                                 |
| **Prove**  | User meminta verifikasi; issuer terdaftar meninjau bukti lalu menyetujui. Backend membangun VC W3C 2.0 / Open Badges, meng-anchor `sha256(JCS(vc))` ke `CredentialRegistry` di BNB Smart Chain Testnet, dan menandatangani EIP-712. |
| **Share**  | Profil publik `/p/<slug>`, QR, CV PDF. `/verify/<id>` menampilkan status dari chain; **verifikasi independen** menghitung ulang hash di browser dan membaca blockchain langsung — tetap jalan walau server Proven mati.             |
| **AI**     | Ringkasan, CV, tailoring lowongan, klasifikasi bukti, cek klaim — hanya dari data user, dengan guardrail deterministik. Skill tanpa bukti: _“Skill detected — evidence not found.”_ AI tidak pernah memberi status Terverifikasi.   |

**Aturan emas:** tidak ada PII on-chain (hanya `bytes32`/`address`/`uint`/`bool`, diuji), AI tidak mengarang,
issuer adalah otoritas, kunci privat hanya di server, hash kredensial deterministik, human-in-the-loop.

## Arsitektur (full cloud, tanpa Docker)

```
Browser ──► Vercel (Next.js 14, apps/web) ──► /api/* → Fastify (apps/api, in-process)
                │                                   ├─► Neon Postgres (Prisma)
                │                                   ├─► BNB Smart Chain Testnet (viem → CredentialRegistry, IssuerRegistry)
                │                                   └─► Claude (opsional, @anthropic-ai/sdk) / mock
                └── verifikasi independen ─────────────► RPC publik BSC Testnet (tanpa server Proven)
GitHub Actions: CI (lint, typecheck, test + Postgres + Anvil, Foundry, Playwright E2E) · ops.yml (deploy, register, seed)
```

| Paket                | Isi                                                                               |
| -------------------- | --------------------------------------------------------------------------------- |
| `apps/web`           | Next.js 14 App Router: user, issuer, verifier UI; route `/api/[...path]`          |
| `apps/api`           | Fastify 4: SIWE, profil, evidence, issuer flow, verify, AI; chain adapter (viem)  |
| `packages/contracts` | Foundry: `IssuerRegistry`, `CredentialRegistry`, `CredentialSBT` + ABI TypeScript |
| `packages/vc`        | VC toolkit isomorphic: schema, JCS + SHA-256, EIP-712, `verifyVC`                 |
| `packages/ai`        | LLM client (Claude/mock), prompt bervesi, guardrail, eval                         |
| `packages/db`        | Prisma schema + migrasi (Postgres 16)                                             |
| `packages/ui`        | Design system "Ledger & Seal" (tema hijau)                                        |

## Kualitas

| Pemeriksaan                     | Hasil                                                                                                   |
| ------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Kontrak (Foundry)               | 46 test, coverage 100%                                                                                  |
| API (Vitest + Postgres + Anvil) | 118 test, coverage 96%                                                                                  |
| VC toolkit                      | 19 test (golden vector), coverage 95%                                                                   |
| AI guardrail                    | 17 test (dataset negatif, prompt injection), coverage 85%                                               |
| Browser (Playwright)            | 12 test: core loop via UI, verifikasi independen tanpa API, VC diubah, revoke, privasi, No PII on-chain |

## Pengembangan

Tidak wajib — semua bisa dicek lewat CI dan preview Vercel. Untuk menjalankan di laptop: Node 22, pnpm 9 (`corepack`),
Foundry (untuk kontrak), Postgres 16 dan Anvil.

```bash
pnpm install
pnpm lint && pnpm typecheck && pnpm test && pnpm build
pnpm test:contracts                 # Foundry
anvil & pnpm contracts:deploy:local # kontrak lokal
DATABASE_URL_TEST=… pnpm e2e        # Playwright (butuh Anvil + Postgres)
pnpm coverage
```

Setiap gelombang: branch `wN-*` → PR → GitHub Actions + preview Vercel → merge. Rahasia hanya di Vercel Environment
Variables dan GitHub Secrets (daftar: [`.env.example`](.env.example)).
