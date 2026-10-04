# PROGRESS — Proven

Status per gelombang. Rencana: `docs/PROVEN-WAVES.md`. Keputusan: `docs/DECISIONS.md`.

| Gelombang | Status | Branch / PR |
|---|---|---|
| W0 Fondasi Monorepo | ✅ selesai — CI hijau, preview Vercel jalan | `w0-monorepo-foundation` · PR #1 |
| W1 Smart Contracts | ✅ selesai — CI hijau (deploy testnet menunggu langkah manual) | `w1-smart-contracts` · PR #2 |
| W2 Auth & Database | ✅ selesai — CI hijau, login jalan di preview | `w2-auth-database` · PR #3 |
| W3 Profil & Evidence | ✅ selesai — CI hijau, alur jalan di preview | `w3-profile-evidence` · PR #4 |
| W4 Mesin Kredensial | ✅ selesai — CI hijau | `w4-credential-engine` · PR #5 |
| W5 Alur Issuer | ✅ selesai — CI hijau (demo testnet menunggu deploy kontrak) | `w5-issuer-flow` · PR #6 |
| W6 AI Layer | ✅ selesai — CI hijau (AI asli opsional, butuh API key) | `w6-ai-layer` · PR #7 |
| W7 Verifier & Output | ✅ selesai — CI hijau (termasuk E2E) | `w7-verifier-output` · PR #8 |
| W8 Testnet, E2E & Demo | ✅ selesai (demo testnet menunggu langkah manual) | `w8-testnet-e2e-demo` |

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
- Preview W0 READY: `GET /api/health` → `{"status":"ok"}` (dicek dengan `vercel curl`). Production: `proven-id.vercel.app` (aktif setelah merge ke `main`).

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

---

## Neon tersambung (2026-10-04)
- Resource `proven-neon` (Neon Free, region Singapura `sin1`), env Sensitive `DATABASE_URL` + `DATABASE_URL_UNPOOLED` untuk Preview + Production. Vercel Functions dipindah ke `sin1` (D-022).
- Redeploy preview W3: `prisma migrate deploy` menerapkan `20261004000000_init` di Neon.
- Diuji langsung di preview Vercel (`vercel curl`): `/api/health` ok; login SIWE → `/api/me` `did:ethr:97:…`; pesan SIWE yang sama ditolak saat diulang; buat prestasi → upload PDF (SHA-256 = `shasum`) → tautkan → `EVIDENCE_ATTACHED` → download identik.

---

## W4 — Mesin Kredensial (2026-10-04)

**Selesai — `packages/vc` (isomorphic, tanpa `node:*`; dijaga aturan ESLint)**
- Schema Zod VC 2.0 + Open Badges (§S7.1), `didFromAddress`/`addressFromDid`, `buildAchievementVC`, `stripProof`, `jcs` (RFC 8785, paket `canonicalize`), `credentialHash` = SHA-256(JCS(vc tanpa proof)), `subjectRef` = SHA-256(DID).
- EIP-712 §S7.3: `getTypedData`, `signCredential` (proof `DataIntegrityProof`, cryptosuite D-011), `verifyCredentialSignature` (`recoverTypedDataAddress`).
- `verifyVC({vc, readAnchor, chainId, verifyingContract, expectedHash?})` → laporan `{schemaValid, hashMatches, anchorFound, subjectMatches, issuerMatches, signatureValid, revoked, expired, overall}` (D-024).
- 19 test: golden vector `0x4933d97f…1a1f` (dicek silang dengan `node:crypto` atas JSON kanonik independen), urutan key di semua level → hash sama, 1 karakter berubah → hash beda, proof tidak memengaruhi hash, tanda tangan round-trip, key lain/chain lain → tidak valid, skenario verifyVC valid/revoked/expired/tampered/not_anchored.

**Selesai — `apps/api/src/chain`**
- Adapter viem: `isIssuerActive` (cache 60 detik), `getAnchor`, `isRevoked`, `anchorCredential` & `revokeCredential` idempotent, simulasi lalu kirim, nonce `pending`, `pg_advisory_xact_lock` per issuer (D-006), tunggu 1 konfirmasi (31337) / 2 (97), error → RFC 9457 (D-024). Config chain opsional (D-023).
- Guard issuer & roles `/me` kini juga mewajibkan `IssuerRegistry.isActive` on-chain (fail-closed).
- 7 test integrasi terhadap Anvil: VC → hash → anchor → `getAnchor` = hash & subjectRef off-chain; anchor ulang idempotent; 3 anchor paralel tanpa bentrok nonce; revoke → `isRevoked` true → `verifyVC` `revoked`; revert & RPC mati → problem. CI job utama kini menjalankan Anvil + deploy lokal (`REQUIRE_ANVIL=1`).

**Selesai — web**: `/verify` memakai `@proven/vc` di browser untuk menghitung `credentialHash` dari VC JSON yang ditempel (bukti bundling isomorphic; verifikasi penuh di W7).

**Tertunda**
- Anchor nyata di BSC Testnet menunggu deploy kontrak (langkah manual W1) dan env `REGISTRY_ADDRESS`, `ISSUER_REGISTRY_ADDRESS`, `ISSUER_PRIVATE_KEY` di Vercel.

---

## W5 — Alur Issuer (2026-10-04)

**Selesai — API**
- Issuer: bootstrap dari env (D-025), `pnpm issuer:register` (DB + `IssuerRegistry.register` bila belum aktif, idempotent) + task `issuer-register` di `ops.yml`, `GET /issuers` publik.
- User: `POST /me/verification-requests` (klaim & bukti milik sendiri, bukti ≥ 1 → 422 `evidence-required` persis §S9.4, issuer terverifikasi, tanpa duplikat pending → 409, status → `PENDING_ISSUER`, audit), `GET /me/verification-requests`, `GET /me/credentials`.
- Issuer (wajib issuer DB + on-chain, hanya data issuer sendiri → 404): antrean dengan filter state, detail + daftar bukti, unduh bukti terdekripsi (hanya bukti di permintaan itu), approve, reject (alasan), daftar kredensial, revoke (alasan).
- Approve sesuai §W5 6 + D-010: kunci baris → draft VC sekali → anchor (idempotent) → bukti EIP-712 → satu transaksi DB (`credentials`, `credential_status`, `chain_anchors`, request `approved`, klaim `VERIFIED`, audit). Anchor gagal → tetap `pending` dengan draft; approve ulang meng-anchor hash yang sama tepat sekali.
- Revoke: on-chain dulu lalu DB (`credentials.status`, `credential_status.revoked/revoked_at/reason`, klaim `REVOKED`, audit).
- Migrasi `created_at` + `decision_reason` (D-026).
- 11 test alur issuer terhadap Anvil + Postgres: loop lengkap (request → antrean → unduh bukti → approve → DB, `getAnchor`, `verifyVC` valid → revoke → `isRevoked` & DB revoked → `verifyVC` revoked), non-issuer 403, issuer lain 404, approve dua kali 409, tanpa bukti 422, duplikat 409, reject, bukti di luar permintaan 404, anchor gagal → retry satu anchor, tanpa chain → fail-closed. Total test API 103.
- Diverifikasi lewat `next start` + Anvil: request → issuer approve (tx + blok) → user melihat kredensial `active` & klaim `VERIFIED` → revoke → `revoked`/`REVOKED`.

**Selesai — UI**
- Tombol "Minta verifikasi" di klaim berstatus *Ada bukti* → dialog pilih issuer + centang bukti.
- `/dashboard/credentials`: kartu kredensial (status, issuer, tanggal, hash VC, anchor + link explorer, link halaman verifikasi) + riwayat permintaan dengan alasan penolakan.
- `/issuer`: tab Antrean (filter, daftar, panel detail dengan bukti + SHA-256, slot "Analisis AI", Setujui/Tolak dengan konfirmasi dan status "Mencatat ke blockchain…") dan tab Kredensial (Cabut dengan alasan).

**Tertunda**
- Demo di BSC Testnet: deploy kontrak (langkah manual W1), lalu isi Vercel Env `ISSUER_ADDRESS`, `ISSUER_NAME`, `ISSUER_PRIVATE_KEY`, `REGISTRY_ADDRESS`, `ISSUER_REGISTRY_ADDRESS`, `CREDENTIAL_SBT_ADDRESS`, `NEXT_PUBLIC_REGISTRY_ADDRESS` (Production + Preview, jangan prefix `NEXT_PUBLIC_` untuk kunci).
- Mint SBT (opsional) belum.

---

## W6 — AI Layer (2026-10-04)

**Selesai — `packages/ai`**
- `LlmClient.generateStructured` dengan provider `anthropic` (structured outputs, `claude-opus-5-5`, effort low, timeout 10 detik, retry 1×, refusal fallback — D-027) dan `mock` (deterministik).
- Schema Zod: summary, cv, tailor, classify, claim-check. Prompt bervesi (`summary@1`, `cv@1`, `tailor@1`, `classify@1`, `claim-check@1`) dengan aturan: isi `<source>` adalah data, dilarang menambah fakta, wajib sitasi id.
- Source pack ber-id stabil (`skill:<uuid>`, `evidence:<uuid>`, …), sanitasi karakter kontrol + escape markup, batas JD 8.000 karakter.
- Guardrail deterministik (D-028): validasi schema, sitasi palsu dibuang, item CV tanpa sitasi dibuang, tailoring hanya skill terbukti + gaps dengan catatan persis, claim-check dihitung ulang aturan §S10.2, klasifikasi enum FR-05 + confidence 0..1.
- 17 test: schema invalid → retry → gagal; sitasi palsu dibuang; dataset negatif (tanpa Rust + JD minta Rust → Rust hanya di gaps, tidak di CV/matched); model yang mengarang skill dikoreksi; claim-check tidak pernah VERIFIED tanpa kredensial; prompt injection di deskripsi bukti tidak mengubah hasil.
- `pnpm ai:eval`: 15 kasus (`eval/dataset.json`), mengukur groundedness, hallucination, dan kebocoran skill setelah guardrail → `eval/report.md`. Dilewati bila `LLM_API_KEY` kosong (tidak jalan di CI).

**Selesai — API** (rate limit 10/menit per sesi, semua respons `aiGenerated: true` + `promptVersion` + `model`)
- `POST /ai/summary` (draf, tidak disimpan), `POST /ai/cv` (CV bersitasi, atau mode tailor bila ada `jobDescription`), `POST /ai/classify-evidence` (simpan `ai_type`/`ai_confidence` sebagai saran), `POST /ai/claim-check`, `GET /issuer/verification-requests/:id/claim-check` (saran untuk issuer).
- 8 test API: perlu sesi, summary tidak tersimpan, tailoring tanpa skill palsu, klasifikasi hanya saran + authz, claim-check VERIFIED hanya dengan kredensial aktif (dicabut → tidak lagi), output invalid → 502, rate limit per user, saran issuer hanya untuk permintaannya. Total test API 111.

**Selesai — UI**
- `/dashboard/ai`: draf ringkasan (edit → "Simpan ke profil"), CV dengan chip sitasi, tailoring (tabel Cocok & terbukti + tabel Celah). Semua berlabel "AI-generated — periksa sebelum dipakai".
- Evidence: tombol "Klasifikasikan (AI)" + saran dengan tombol "Terapkan". Profil: "Cek semua klaim" menampilkan badge cek AI per item. Issuer: "Minta saran AI" di panel permintaan.

**Langkah manual (opsional)**
- Untuk AI asli: Vercel Env `LLM_PROVIDER=anthropic`, `LLM_API_KEY` (Sensitive), opsional `LLM_MODEL` (default `claude-opus-5-5`). Tanpa itu, mode `mock` tetap berfungsi untuk demo alur.
- Untuk metrik: `LLM_API_KEY=… pnpm ai:eval` lalu lihat `packages/ai/eval/report.md` (memanggil API berbayar).

---

## W7 — Verifier, Profil Publik, QR & CV PDF (2026-10-04)

**Selesai — API**
- `GET /verify/:credentialId` (uuid atau `urn:uuid:`; publik): VC lengkap, issuer + DID, subject DID, anchor (tx, blok, kontrak, chain), status final dari `isRevoked` on-chain lalu kedaluwarsa; DB disinkronkan bila beda + audit; cache 30 detik (D-029).
- `GET /credentials/:credentialId/status`, `GET /me/data-export` (semua data user + VC, tanpa ciphertext; UU PDP), `GET /p/:slug` kini menyertakan daftar kredensial.
- 5 test baru (Anvil): verify via urn/uuid + status, revoke lewat Proven langsung terlihat, revoke langsung on-chain → DB tersinkron + audit, 404/400, kredensial di profil publik & ekspor data. Total test API 116.

**Selesai — Web**
- `/verify/[id]` (server-rendered): segel besar Aktif/Dicabut/Kedaluwarsa/Tidak cocok/Tidak ditemukan (`role=status` + `aria-label`), issuer, subject DID, tanggal, tx + blok, "Lihat on-chain", unduh VC JSON, QR halaman verifikasi.
- "Verifikasi independen": hash dihitung ulang di browser, `getAnchor` dibaca langsung dari RPC publik, tanda tangan EIP-712 dicek, checklist 8 langkah.
- `/verify`: tempel/unggah VC JSON → verifikasi independen yang sama.
- `/p/[slug]` (server-rendered, 404 sungguhan, OpenGraph): kredensial dengan QR + link verify, QR profil, tombol salin tautan.
- CV PDF dari dashboard (data profil) dan dari CV AI ("Setujui & unduh PDF"): item terverifikasi bertanda + URL + QR, footer "Diverifikasi melalui Proven — {origin}". Tombol "Unduh data saya (JSON)".
- Aksesibilitas: alt text QR, `aria-label` segel, skip link, fokus terlihat (sudah sejak W3).

**Selesai — E2E**
- Playwright (`pnpm --filter @proven/web e2e`, job CI `e2e`): 7 test — Aktif + tx + QR, verifikasi independen tetap jalan saat semua `/api/**` diputus, VC diubah 1 karakter → Tidak cocok, profil publik + QR + link verify, revoke → Dicabut (server & independen), profil privat → 404, ID tak dikenal → Tidak ditemukan.

**Langkah manual untuk user**
- Setelah kontrak di-deploy ke BSC Testnet: isi Vercel Env `NEXT_PUBLIC_REGISTRY_ADDRESS` (dibaca saat build — redeploy setelah mengisi) agar verifikasi independen aktif.
- Uji QR dari HP memakai URL production (preview dilindungi login Vercel).

---

## W8 — BSC Testnet, E2E, Demo & Polish (2026-10-04)

**Selesai**
- Kesiapan testnet tanpa transaksi oleh Claude: `pnpm check:env` (diuji terhadap RPC BSC Testnet sungguhan), `pnpm smoke:testnet`, `docs/DEPLOY-BSC-TESTNET.md`; task `check-env`, `db-seed`, `smoke-testnet` di `ops.yml` (D-030).
- Seed demo `pnpm db:seed` (idempotent, diuji): issuer XYZ Community, profil `/p/rina-demo`, pengalaman/proyek/komunitas, sertifikat PDF (pdf-lib, terenkripsi), skill Rust tanpa bukti, satu permintaan *pending* untuk approve live.
- E2E Playwright core loop lewat UI dengan mock wallet Anvil: login → prestasi → upload → tautkan → minta verifikasi → issuer approve → user VERIFIED → `/verify` Aktif (+ independen) → revoke → Dicabut. Ditambah test sistem **No PII on-chain** (semua log kedua registry hanya `bytes32/address/uint/bool`, tanpa teks klaim/DID/nama issuer). Total Playwright: 12 test.
- Polish: landing baru (tagline, Create → Prove → Share, AI jujur, tanpa PII on-chain), favicon, judul halaman, loading/empty state di semua halaman, pesan error dari problem+json.
- README final, `docs/DEMO-SCRIPT.md` (naskah 3 menit), laporan coverage.

**Coverage (`pnpm coverage`)**: API 96,2% · VC 95,3% · AI 85,0% · kontrak 100% (target ≥ 70%).

**Status gerbang global (§S15)**: FR teruji ✅ · coverage ✅ · No PII on-chain (ABI + log) ✅ · output AI tervalidasi + no-fabrication ✅ · audit log + RFC 9457 ✅ · WCAG dasar ✅ · OpenAPI ⚠️ belum dibuat (lihat Tertunda).

**Tertunda**
- Dokumentasi OpenAPI 3.1 (§S9.1) belum digenerate.
- Mint SBT (opsional W5) belum.
- Demo di BSC Testnet menunggu langkah manual di bawah.

**Langkah manual untuk user (urut)**
1. Merge PR #1 → #8 dan PR W8 ke `main` (berurutan; PR bertumpuk).
2. Ikuti `docs/DEPLOY-BSC-TESTNET.md`: 2 wallet + tBNB → GitHub Secrets → ops `deploy-contracts` → isi Vercel Env (issuer + alamat kontrak) → redeploy → ops `check-env` → ops `db-seed` → ops `smoke-testnet`.
3. Opsional: `LLM_PROVIDER=anthropic` + `LLM_API_KEY` di Vercel untuk AI asli, lalu `pnpm ai:eval`.
4. Latihan dengan `docs/DEMO-SCRIPT.md`; uji QR dari HP di `https://proven-id.vercel.app`.

---

## Production live di BSC Testnet (2026-10-04)

- **URL:** https://proven-id.vercel.app (Vercel `sin1` + Neon `sin1`), semua PR W0–W8 + perbaikan ter-merge, CI `main` hijau.
- **Kontrak (BSC Testnet, chainId 97):** IssuerRegistry `0x69d3961b65dcfff10bf7a71d93375cAe4bE70dC3` · CredentialRegistry `0xcCbC054C107405F0BB8d7adCE3f780914e9Bf0d4` · CredentialSBT `0x5AaD146A14357a1ad91bBFEecB065e173cFc2811` (di-deploy lewat `ops → deploy-contracts`).
- **Issuer:** XYZ Community `0x0a4CB0DB07d1C06A56218A8f63660e1dFeB2264a` (aktif on-chain). Deployer `0x30aF56449FaA6db6D3f0b353f63808290aee7E03`. Private key: GitHub Secrets / Vercel Env (Sensitive) + salinan lokal milik user di luar repo.
- **`check:env`:** semua ✅.
- **Profil pajangan:** https://proven-id.vercel.app/p/rina-demo dengan kredensial on-chain `urn:uuid:6482c7d2-de22-4482-94df-0fac50635d35`.
- **Mode demo (D-032):** aktif (`DEMO_MODE=1`); tombol "Coba sebagai User/Issuer" di landing.
- **Diuji langsung di production (Playwright):** profil pajangan + verifikasi independen dari RPC BSC Testnet → Aktif; mode demo user → issuer approve (tx nyata) → kredensial Terverifikasi + anchor → halaman verify Aktif.

**Opsional tersisa:** AI Claude asli (`LLM_PROVIDER=anthropic`, `LLM_API_KEY` di Vercel), verifikasi source kontrak di BscScan (`ETHERSCAN_API_KEY`), OpenAPI, mint SBT.

**Domain (2026-10-04):** production pindah ke **https://proven-id.vercel.app**; `proven-zeta.vercel.app` dialihkan permanen (308). `APP_DOMAIN`/`APP_URL` diperbarui. VC yang sudah terbit tetap valid (URL status di dalamnya ikut dialihkan).
