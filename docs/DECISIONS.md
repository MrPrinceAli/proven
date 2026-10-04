# DECISIONS — Proven

Catatan keputusan saat spesifikasi ambigu, bertentangan, atau perlu disesuaikan. Format: konteks → keputusan → konsekuensi.
Entri terbaru ditambahkan di bawah. Tanggal dalam ISO 8601.

---

## D-001 — Full cloud, tanpa Docker (2026-10-04)
**Konteks:** Spesifikasi awal memakai `docker-compose` (Postgres, Anvil, MinIO) di laptop. User ingin proyek tidak bergantung pada laptop: push ke GitHub, cek hasil lewat preview Vercel, semua gratis (hackathon).
**Keputusan:** Tidak ada Docker dan tidak ada infra lokal. GitHub Actions = CI (Postgres service container + Anvil di runner). Vercel Hobby = web + API. Neon = Postgres. Operasi on-chain dan DB production lewat `workflow_dispatch` (`ops.yml`).
**Konsekuensi:** §S12.2 diganti; gerbang tiap gelombang dicek lewat CI + preview Vercel. Kode harus serverless-safe.

## D-002 — Chain demo: BSC Testnet (chainId 97) (2026-10-04)
**Konteks:** Spesifikasi memakai Base Sepolia 84532. Penyelenggara hackathon adalah BNB Chain.
**Keputusan:** Demo di BSC Testnet (97), explorer `testnet.bscscan.com`, verifikasi kontrak dengan Etherscan API V2 key. Anvil 31337 hanya di CI. DID tetap `did:ethr:{chainId}:{address lowercase}` → `did:ethr:97:0x…`.
**Konsekuensi:** Kontrak tidak berubah (EVM, `evm_version = cancun` didukung BSC). Gas = tBNB dari faucet (lihat §S13 untuk syarat faucet).

## D-003 — API Fastify di-mount di Next.js `/api/*` (satu project Vercel) (2026-10-04)
**Konteks:** Spesifikasi memisahkan web (:3000) dan API (:4000). Di Vercel, dua project = dua domain `*.vercel.app` yang berbeda site, sehingga cookie sesi `SameSite=Lax` tidak terkirim dan URL preview web/API tidak berpasangan.
**Keputusan:** `apps/api` mengekspor `buildApp()` (Fastify, tanpa `listen`). `apps/web/app/api/[...path]/route.ts` meneruskan request ke Fastify via `app.inject()` setelah membuang prefix `/api`. Route Fastify tetap tanpa prefix; klien memanggil `/api/...` relatif.
**Konsekuensi:** Satu origin → cookie first-party, tanpa CORS lintas domain, preview web+API selalu sepasang. `apps/api/src/server.ts` tetap ada untuk dev opsional.

## D-004 — Ciphertext evidence disimpan di Postgres (2026-10-04)
**Konteks:** MinIO tidak tersedia tanpa Docker; S3/R2 menambah akun & kredensial.
**Keputusan:** Interface `EvidenceStore {put, get, delete}`; implementasi MVP = tabel `evidence_blobs` (bytea, §S6.3). `evidence.storage_key = 'pg:{uuid}'`. Enkripsi AES-256-GCM tetap sama.
**Konsekuensi:** Tanpa layanan storage tambahan; kuota Neon free cukup untuk demo. Implementasi S3/R2 = roadmap.

## D-005 — Batas ukuran evidence 4 MB (2026-10-04)
**Konteks:** FR-04 menyebut ≤ 10 MB, tetapi body request/response Vercel Function dibatasi 4,5 MB.
**Keputusan:** Batas aplikasi 4 MB (413 jika lebih); UI memvalidasi sebelum upload. Test "10 MB+1" menjadi "4 MB+1".
**Konsekuensi:** Sertifikat/foto biasa muat. Upload langsung ke object storage via presigned URL = roadmap bila perlu > 4 MB.

## D-006 — Serialisasi transaksi on-chain dengan advisory lock Postgres (2026-10-04)
**Konteks:** W4 meminta mutex in-process agar nonce tx tidak bentrok; di serverless ada banyak instance paralel.
**Keputusan:** `pg_advisory_xact_lock(hashtext(issuerAddress))` di dalam transaksi DB selama kirim tx + tunggu receipt; nonce diambil dengan `blockTag: "pending"`.
**Konsekuensi:** Aman lintas instance. Cache `isIssuerActive` hanya best-effort per instance.

## D-007 — Domain SIWE yang diizinkan (2026-10-04)
**Konteks:** Setiap preview Vercel punya domain berbeda; pemeriksaan `domain == APP_DOMAIN` akan menolak login di preview.
**Keputusan:** Domain diizinkan = `APP_DOMAIN` ∪ `VERCEL_URL` ∪ `VERCEL_BRANCH_URL` ∪ `VERCEL_PROJECT_PRODUCTION_URL` (system env Vercel, dibaca server). Header `Host` tidak dipercaya. Origin = `https://{domain}` (http hanya localhost).
**Konsekuensi:** Login bekerja di preview & production tanpa melemahkan perlindungan phishing SIWE.

## D-008 — CI dan operasi lewat GitHub Actions (2026-10-04)
**Konteks:** Deploy kontrak, register issuer, dan seed butuh private key; tidak boleh di laptop/chat.
**Keputusan:** `ci.yml`: lint, typecheck, test, build, job `contracts` (Foundry + Anvil + deploy lokal + smoke), integrasi & E2E terhadap Anvil + Postgres di runner. `ops.yml` (`workflow_dispatch`, input `task`): `deploy-contracts` (W1), `issuer-register` (W5), `check-env`/`db-seed`/`smoke-testnet` (W8). Rahasia hanya di GitHub Secrets & Vercel Env (§S12.3). Claude tidak pernah menjalankan `ops.yml`.
**Konsekuensi:** Langkah manual user = mengisi Secrets/Env dan menekan "Run workflow".

## D-009 — Prisma + Neon di Vercel (2026-10-04)
**Konteks:** Serverless butuh connection pooling; migrasi butuh koneksi langsung; preview tidak boleh memigrasi DB production.
**Keputusan:** `url = DATABASE_URL` (pooled), `directUrl = DATABASE_URL_UNPOOLED`; `binaryTargets = ["native", "rhel-openssl-3.0.x"]`; build Vercel menjalankan `prisma migrate deploy` sebelum `next build`; integrasi Neon membuat branch DB per preview.
**Konsekuensi:** Preview punya DB sendiri (salinan production saat branch dibuat). `EVIDENCE_ENC_KEY` harus sama di Production & Preview.

## D-010 — Draft VC agar approve ulang idempotent (2026-10-04)
**Konteks:** W5 membangun VC dengan `validFrom = now` lalu anchor. Bila anchor sukses tetapi transaksi DB gagal, approve ulang membangun VC baru → hash baru → anchor kedua (anchor pertama yatim).
**Keputusan:** VC tanpa proof dibangun sekali dan disimpan di `verification_requests.draft_vc` (+ `draft_credential_id`, `draft_status_index`) sebelum anchor; approve ulang memakai draft yang sama.
**Konsekuensi:** Tepat satu anchor per request. Ditambahkan ke §S6.3 dan test W5.

## D-011 — Nama cryptosuite proof (2026-10-04)
**Konteks:** Contoh VC memakai `cryptosuite: "ecdsa-jcs-2019"`, padahal proof MVP adalah signature EIP-712 secp256k1. Suite W3C itu memakai P-256/P-384 + multibase, sehingga verifier standar akan salah menafsirkan.
**Keputusan:** `cryptosuite: "eip712-secp256k1-proven-2026"` (tipe proof tetap `DataIntegrityProof`).
**Konsekuensi:** Tidak mengklaim kepatuhan suite yang tidak diimplementasikan. Suite W3C asli = roadmap.

## D-012 — UI ala jejaring profesional (LinkedIn-like), tema hijau (2026-10-04)
**Konteks:** User ingin UI/UX mirip LinkedIn dengan tema warna hijau.
**Keputusan:** Design system "Ledger & Seal" memakai pola layout jejaring profesional (top nav, 3 kolom desktop, kartu putih di latar abu hangat, halaman profil dengan banner + avatar + kartu section) dengan primary hijau `#047857`. Hanya pola tata letak yang diadopsi — tanpa logo, nama, warna biru, ikon, atau teks milik LinkedIn.
**Konsekuensi:** Detail token & layout di tugas 6 W3. Warna status tetap dibedakan dan selalu disertai ikon + teks (WCAG).

## D-013 — Node.js 22, bukan 20 (2026-10-04)
**Konteks:** Stack mengunci Node 20, tetapi Node 20 EOL 30 April 2026 dan Vercel menonaktifkan Node 20 untuk deployment baru sejak 1 Oktober 2026.
**Keputusan:** Node 22.x (`.nvmrc`, `engines.node`, CI, Vercel Project Settings). Versi stack lain tidak berubah.
**Konsekuensi:** Next.js 14 kompatibel dengan Node 22. Disetujui implisit lewat permintaan user untuk deploy di Vercel; dicatat di sini dan di CLAUDE.md.

## D-014 — Script Foundry diberi prefiks, ABI di-commit (2026-10-04, W1)
**Konteks:** W1 meminta script `build` (forge build) dan `test` (forge test) di `packages/contracts`. Turborepo menjalankan `build`/`test` semua paket di job CI utama dan di Vercel, yang tidak punya Foundry.
**Keputusan:** Script Foundry bernama `forge:build`, `forge:test`, `coverage`, `deploy:local`, `smoke:local`, `export-abi`; root `pnpm test:contracts` dan `pnpm contracts:deploy:local` memanggilnya. `test` paket ini = Vitest atas ABI TypeScript. File `abi/*.ts` hasil `export-abi` **di-commit** dan dicek CI (`git diff --exit-code abi/`), supaya `apps/*` bisa di-build tanpa Foundry.
**Konsekuensi:** Foundry hanya dibutuhkan di job CI `contracts` dan workflow `ops.yml`. Setiap perubahan kontrak wajib menjalankan `pnpm --filter @proven/contracts export-abi`.

## D-015 — Versi dependency kontrak (2026-10-04, W1)
**Konteks:** Spesifikasi menyebut OpenZeppelin v5.x (contoh v5.1.0).
**Keputusan:** OpenZeppelin `v5.7.0` (rilis v5 terbaru, kompatibel solc 0.8.24) dan forge-std `v1.17.0`, sebagai git submodule di `packages/contracts/lib` dan dikunci di `foundry.lock`. CI memakai Foundry `v1.7.1`.
**Konsekuensi:** Patch keamanan v5 terbaru ikut terbawa tanpa mengubah API yang dipakai kontrak.

## D-016 — Kolom status tetap `text`, divalidasi Zod (2026-10-04, W2)
**Konteks:** W2 meminta memilih Prisma enum atau string tervalidasi Zod untuk status/visibility/state.
**Keputusan:** Tetap `text` seperti DDL §S6.2; nilai sah didefinisikan di `packages/db/src/enums.ts` (Zod) dan dipakai di setiap boundary. `CLAIM_WITHOUT_EVIDENCE` sengaja tidak termasuk status tersimpan (hanya label claim-check, §S4).
**Konsekuensi:** Skema DB sama persis dengan DDL; menambah nilai tidak butuh migrasi enum Postgres.

## D-017 — Verifikasi tanda tangan SIWE: lokal dulu, RPC sebagai fallback (2026-10-04, W2)
**Konteks:** `publicClient.verifySiweMessage` (viem) mencoba verifikasi ERC-6492 lewat RPC sebelum ECDSA, sehingga setiap login bergantung pada RPC publik dan test butuh jaringan.
**Keputusan:** Field pesan (domain, uri, chainId, waktu, nonce) divalidasi sendiri; tanda tangan EOA diverifikasi lokal dengan `verifyMessage` (ECDSA), dan hanya jika gagal dicoba `publicClient.verifyMessage` (ERC-1271/6492, untuk smart wallet). Nonce dikonsumsi atomik setelah tanda tangan valid.
**Konsekuensi:** Login EOA tidak menyentuh RPC; smart wallet tetap didukung.

## D-018 — Wallet connect: AppKit opsional, fallback MetaMask; kompatibilitas paket (2026-10-04, W2)
**Konteks:** Reown AppKit butuh Project ID (akun reown.com). Adapter AppKit 1.8.24 punya optional dependency `@wagmi/connectors >=5.9.9` yang ter-resolve ke 8.x (generasi wagmi v3) dan merusak build dengan wagmi 2; konektor Base Account menarik peer opsional `@x402/*` yang tidak terpasang.
**Keputusan:** Jika `NEXT_PUBLIC_REOWN_PROJECT_ID` kosong, web memakai wagmi + konektor `injected` (MetaMask dan wallet browser lain); jika terisi, AppKit dipakai. `pnpm.overrides` mengunci `@reown/appkit-adapter-wagmi>@wagmi/connectors` ke `6.2.0`. Webpack meng-alias `@x402/*` dan `@react-native-async-storage/async-storage` ke modul kosong.
**Konsekuensi:** Login bisa dicoba tanpa akun Reown. Upgrade wagmi/AppKit harus mengecek ulang override ini.

## D-019 — Migrasi database saat build Vercel (2026-10-04, W2)
**Konteks:** Tidak ada server/laptop untuk menjalankan `prisma migrate deploy`; Neon membuat branch DB per preview.
**Keputusan:** Build Command project Vercel = `pnpm run build:vercel` (`apps/web`), yang menjalankan `packages/db/scripts/migrate-deploy.mjs` lalu `next build`. Jika `DATABASE_URL` belum ada, migrasi dilewati dengan peringatan dan API menjawab 503 problem+json berisi nama variabel yang kurang.
**Konsekuensi:** Setiap deploy preview/production memigrasi DB-nya sendiri. Build tetap hijau sebelum Neon tersambung.
