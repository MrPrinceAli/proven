# PROGRESS — Proven

Status per gelombang. Rencana: `docs/PROVEN-WAVES.md`. Keputusan: `docs/DECISIONS.md`.

| Gelombang | Status | Branch / PR |
|---|---|---|
| W0 Fondasi Monorepo | ✅ selesai — CI hijau, preview Vercel jalan | `w0-monorepo-foundation` · PR #1 |
| W1 Smart Contracts | ✅ selesai — CI hijau (deploy testnet menunggu langkah manual) | `w1-smart-contracts` · PR #2 |
| W2 Auth & Database | ✅ selesai — CI hijau (login di preview menunggu Neon) | `w2-auth-database` · PR #3 |
| W3 Profil & Evidence | ✅ selesai (uji di preview menunggu Neon) | `w3-profile-evidence` |
| W4–W8 | ⏳ belum | — |

---

## W0 — Fondasi Monorepo (2026-10-04)

**Selesai**
- Monorepo pnpm 9.15.9 + Turborepo 2 (`apps/*`, `packages/*`, `services/*`), Node 22 (`.nvmrc`, `engines`).
- TypeScript 5.4 strict (`tsconfig.base.json`), ESLint 8 bersama + Prettier 3 (`pnpm format:check` di CI).
- `apps/api`: `buildApp()` Fastify 4 dengan `GET /health`, `createWebHandler()` (adapter Fastify → Web `Request/Response`), `src/server.ts` untuk dev opsional. Test: health + adapter (prefix, query, header, body JSON, multi `set-cookie`, 204, build sekali).
- `apps/web`: Next.js 14.2.35 App Router + Tailwind 3.4, landing dengan tagline, route `src/app/api/[...path]/route.ts` yang melayani API di `/api/*` (D-003). Diverifikasi lokal: `next build` + `next start` → `GET /api/health` = `{"status":"ok"}`.
- `packages/vc`, `ai`, `db`: kerangka + test dummy. `packages/ui`: `Button` (tema hijau) + test. `packages/contracts`: README placeholder.
- `.env.example` = §S12.1, `.gitignore`, `.editorconfig`, README.
- CI `.github/workflows/ci.yml`: install → format check → lint → typecheck → test → build, dengan service Postgres 16 (dipakai mulai W2).

**Catatan teknis**
- Paket workspace memakai pola *internal package* (export langsung `src/index.ts`, dikompilasi Next via `transpilePackages`), jadi paket library tidak punya langkah build sendiri; `typecheck` yang memvalidasinya.

**Vercel**
- Project `proven` (team Viclatess) dibuat lewat Vercel CLI: root `apps/web`, Node 22.x, framework Next.js, tersambung ke repo GitHub.
- Preview W0 READY: `GET /api/health` → `{"status":"ok"}` (dicek dengan `vercel curl`). Production: `proven-zeta.vercel.app` (aktif setelah merge ke `main`).

**Langkah manual untuk user**
- Merge PR W0 ke `main` agar URL production aktif (preview dilindungi login Vercel).

---

## W1 — Smart Contracts (2026-10-04)

**Selesai**
- Foundry di `packages/contracts`: `foundry.toml` (§S8.5, `bsc_testnet` chain 97), OpenZeppelin v5.7.0 + forge-std v1.17.0 sebagai submodule (D-015).
- Kontrak persis §S8.1–§S8.3: `IssuerRegistry`, `CredentialRegistry`, `CredentialSBT`, `IERC5192`. Script §S8.4: `Deploy.s.sol`, `RegisterIssuer.s.sol`.
- 46 test Foundry: IssuerRegistry (10), CredentialRegistry (20, termasuk 2 fuzz), CredentialSBT (13), NoPII (3 — ABI kedua registry hanya boleh `bytes32/bytes4/address/uintN/bool`). Coverage `src/` **100%** line/statement/branch/function.
- `scripts/deploy-local.sh` (Anvil #0 deployer, #1 issuer; menolak chain selain 31337), `scripts/smoke-local.sh` (§S8.6 dengan asersi), `scripts/export-abi.mjs` → `abi/*.ts` di-commit, paket `@proven/contracts` (D-014).
- Diverifikasi lokal terhadap Anvil: deploy → `deployments/31337.json` berisi 3 address; smoke test `isActive` true, `isRevoked` false → revoke → true.
- CI job `contracts`: build, test, coverage (ke job summary), cek ABI ter-commit, Anvil + deploy + smoke.
- `.github/workflows/ops.yml` task `deploy-contracts`: deploy ke BSC Testnet + register issuer + verifikasi BscScan (opsional) + ringkasan address + artifact `deployments-97`.

**Tertunda**
- Deploy ke BSC Testnet — menunggu langkah manual (butuh tBNB). Boleh ditunda sampai sebelum W4/W5 diuji di preview.

**Langkah manual untuk user**
1. Buat 2 wallet baru khusus testnet: deployer & issuer (MetaMask atau `cast wallet new`). Simpan private key di password manager.
2. Isi tBNB ke kedua address dari https://www.bnbchain.org/en/testnet-faucet (syarat: wallet punya ≥ 0,002 BNB di BSC mainnet) atau minta ke panitia hackathon.
3. (Opsional, untuk verifikasi kontrak) buat API key di etherscan.io — Etherscan API V2 berlaku untuk BscScan.
4. GitHub repo → Settings → Secrets and variables → Actions → New repository secret:
   `DEPLOYER_PRIVATE_KEY`, `ISSUER_ADDRESS` (EIP-55), `ISSUER_DID` (`did:ethr:97:<address huruf kecil>`), opsional `ISSUER_NAME`, `ETHERSCAN_API_KEY`, `BSC_TESTNET_RPC_URL`.
5. Actions → **ops** → Run workflow → `deploy-contracts` (dari branch `main` setelah PR W1 di-merge).
6. Salin 3 address dari ringkasan run ke Vercel → Environment Variables: `ISSUER_REGISTRY_ADDRESS`, `REGISTRY_ADDRESS`, `CREDENTIAL_SBT_ADDRESS`, `NEXT_PUBLIC_REGISTRY_ADDRESS`.

---

## W2 — Auth & Database (2026-10-04)

**Selesai**
- `packages/db`: Prisma 5.22 schema = DDL §S6.2 + §S6.3 (20 tabel, `citext`, `@@map` snake_case, termasuk `evidence_blobs` dan kolom draft VC), migrasi awal + trigger yang membuat `audit_logs` append-only di level DB, client singleton, enum Zod (D-016). Test: citext case-insensitive, trigger append-only.
- `apps/api`: config Zod gagal-cepat (`loadConfig`), error RFC 9457 (`problem.ts`, termasuk 404/400/429), `@fastify/cookie` (cookie sesi ditandatangani `SESSION_SECRET`), helmet, CORS, rate-limit, helper `audit()`.
- SIWE (FR-01): `POST /auth/siwe/nonce` (EIP-55 wajib, chainId = `CHAIN_ID`, nonce 128-bit, 5 menit), `POST /auth/siwe/verify` (domain & origin dari daftar D-007, chainId, waktu, nonce terikat address+chain, tanda tangan D-017, konsumsi nonce atomik, upsert user+wallet+profile, sesi 7 hari dengan `sha256(token)`), `POST /auth/logout`, `GET /me` (+ roles user/issuer/admin). Guard `requireUser`/`requireIssuer`/`requireAdmin`.
- 29 test API, termasuk 8 test wajib SIWE: replay, nonce kedaluwarsa, domain salah, chainId salah, address tidak cocok, address non-checksum, sesi valid → `/me` 200, logout → `/me` 401. Ditambah: uri origin, tanda tangan palsu, pesan kedaluwarsa, cookie dirusak, audit log, roles.
- `apps/web`: wagmi + Reown AppKit (fallback MetaMask bila Project ID kosong, D-018), alur login connect → nonce → sign → verify → `/dashboard`, `useSession()`, header (nav, DID singkat, Keluar), route guard client, halaman placeholder `/dashboard/*`, `/issuer`, `/p/[slug]`, `/verify`, `/verify/[id]`.
- Diverifikasi lokal dengan `next start` + Postgres: login SIWE lewat HTTP → 200 + cookie `HttpOnly; Secure; SameSite=Lax`, `/api/me` 200 (`did:ethr:97:…`), logout 204 → `/api/me` 401.
- Vercel: Build Command `pnpm run build:vercel` (migrasi lalu build, D-019); env Production + Preview diisi: `SESSION_SECRET`, `EVIDENCE_ENC_KEY` (secret, digenerate langsung ke Vercel), `CHAIN_ID`, `RPC_URL`, `APP_DOMAIN`, `APP_URL`, `NEXT_PUBLIC_CHAIN_ID`, `NEXT_PUBLIC_RPC_URL`, `NEXT_PUBLIC_EXPLORER_URL`, `LLM_PROVIDER`.

**Tertunda**
- Database di Vercel: integrasi Neon butuh persetujuan syarat layanan di browser. Sampai tersambung, `/api/*` di Vercel menjawab 503 dengan pesan `DATABASE_URL: Required`.

**Langkah manual untuk user**
1. Vercel → project **proven** → tab **Storage** → **Create Database** → pilih **Neon** (Serverless Postgres) → paket **Free** → setujui syarat → Connect ke project `proven` untuk **Production + Preview** (aktifkan opsi branch per preview bila ditawarkan). `DATABASE_URL` dan `DATABASE_URL_UNPOOLED` terisi otomatis.
2. Redeploy (Deployments → ⋯ → Redeploy) atau push commit baru.
3. Opsional: buat Project ID gratis di cloud.reown.com (tambahkan domain `*.vercel.app`) → Vercel Env `NEXT_PUBLIC_REOWN_PROJECT_ID`. Tanpa ini login tetap bisa memakai MetaMask.
4. MetaMask → tambahkan jaringan BNB Smart Chain Testnet (chainId 97). Login tidak butuh tBNB.

---

## W3 — Profil & Evidence (2026-10-04)

**Selesai — API**
- `PATCH /me/profile`: headline, summary, visibility, slug (3–40 `[a-z0-9-]`, dinormalisasi huruf kecil, unik case-insensitive via citext → 409, kata cadangan ditolak).
- CRUD `/me/skills|experiences|projects|achievements|community` (POST, GET, PATCH `/:id`, DELETE `/:id`): Zod `.strict()`, object-level authz (milik orang lain → 404), status default `UNVERIFIED`, klaim terverifikasi/menunggu dikunci (D-020), audit log tiap mutasi. `GET /me/claims` untuk ringkasan per status.
- Evidence: upload multipart maks 4 MB (413), MIME dari magic bytes PDF/PNG/JPG (415), SHA-256 atas plaintext, AES-256-GCM (IV 12 byte per file, iv+tag di metadata), ciphertext di `evidence_blobs` lewat `EvidenceStore` (D-004), chain of custody (`metadata.custody[]` + audit `evidence.uploaded`). List, download dengan dekripsi + cek ulang SHA-256 (409 `integrity-mismatch`), koreksi type/judul, hapus, link/unlink dengan transisi `UNVERIFIED ⇄ EVIDENCE_ATTACHED` tanpa pernah menurunkan `PENDING_ISSUER/VERIFIED/REVOKED/EXPIRED`.
- `GET /p/:slug` publik: hanya `visibility=public`; private/recruiter-only/suspended → 404; DID terpotong; tanpa email, storage key, hash, atau isi evidence.
- Test API total 81 (W3 menambah 52): hash deterministik = hash file asli, 4 MB+1 → 413, `.exe` berganti nama `.pdf` → 415, evidence user lain → 404, download memverifikasi integritas (ciphertext diubah → 409), profil privat → 404, slug "Rina" vs "rina" → 409, link → `EVIDENCE_ATTACHED`, plus unlink/hapus/rate-limit.

**Selesai — UI**
- Design system "Ledger & Seal" (D-012) di `packages/ui`: token hijau + preset Tailwind, Button, Card/SectionCard, Badge, Input/Textarea/Select berlabel, Dialog (native `<dialog>`), StatusBadge (7 status, ikon + teks), Avatar, EmptyState, Toast (aria-live), 24 ikon inline.
- AppShell ala jejaring profesional: top nav sticky + pencarian (segera hadir), 3 kolom desktop (kartu profil mini · konten · legenda status), bottom nav mobile, skip link.
- `/dashboard`: jumlah klaim per status + checklist langkah. `/dashboard/profile`: header berbanner hijau + avatar, dialog edit profil, 5 section klaim dengan tambah/ubah/hapus + StatusBadge. `/dashboard/evidence`: dropzone (validasi 4 MB di browser), daftar bukti dengan SHA-256 yang bisa disalin, koreksi jenis, tautkan/lepas klaim, unduh, hapus. `/p/[slug]`: profil publik read-only dengan layout yang sama.
- Diverifikasi lokal lewat `next start` + Postgres: alur gerbang W3 lengkap (profil → upload PDF → SHA-256 = `shasum` → tautkan → `EVIDENCE_ATTACHED` → `/p/slug` tanpa login → privat → 404); screenshot desktop & mobile profil publik dicek.

**Tertunda**
- Uji di preview Vercel menunggu Neon tersambung (langkah manual W2).

**Langkah manual untuk user**
- Setelah Neon tersambung: buka preview PR W3 → login MetaMask → isi profil + slug → tambah prestasi → unggah PDF → tautkan → buka `/p/<slug>` di jendela incognito (perlu Deployment Protection preview dimatikan, atau cek di production setelah merge).
