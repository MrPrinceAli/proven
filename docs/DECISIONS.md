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

## D-020 — Klaim yang sedang/selesai diverifikasi dikunci (2026-10-04, W3)
**Konteks:** Spesifikasi tidak mengatur edit klaim setelah diajukan atau diverifikasi. Mengubah teks klaim `VERIFIED` akan membuat badge "Terverifikasi" menempel pada isi yang tidak pernah dilihat issuer (melanggar aturan emas #3).
**Keputusan:** `PATCH` klaim hanya untuk status `UNVERIFIED`/`EVIDENCE_ATTACHED` (lainnya 409). `DELETE` ditolak hanya saat `PENDING_ISSUER` (agar request issuer tidak yatim). Status tidak pernah bisa dikirim klien (schema `.strict()`).
**Konsekuensi:** Mengoreksi klaim terverifikasi = buat klaim baru dan ajukan ulang.

## D-021 — Detail API evidence (2026-10-04, W3)
**Konteks:** Kolom `evidence.type` wajib (NOT NULL) tetapi FR-05 mengklasifikasikannya dengan AI baru di W6; spesifikasi menulis "POST/DELETE /me/evidence/:id/links".
**Keputusan:** `type` opsional saat upload dengan default `certificate`, bisa dikoreksi lewat `PATCH`/UI. Unlink memakai `DELETE /me/evidence/:id/links?entityType=…&entityId=…` (query, bukan body). Tambahan `GET /me/claims` (semua klaim + jumlah per status) untuk dashboard dan halaman profil. Rate limit SIWE bisa diatur lewat `buildApp({ rateLimit })` (test memakai limit tinggi; ada test 429).
**Konsekuensi:** Tidak ada klasifikasi otomatis sebelum W6; UI meminta jenis bukti saat upload.

## D-022 — Region Singapura untuk database dan server (2026-10-04)
**Konteks:** Neon dibuat di Singapura (`sin1`), sedangkan Vercel Functions default di Washington (`iad1`); tiap query akan menyeberang benua.
**Keputusan:** Project Vercel `serverlessFunctionRegion = sin1` (diatur lewat Vercel API). Neon: region `sin1`, env Sensitive untuk Preview + Production (tanpa Development, karena tidak ada runtime di laptop), branch DB per preview.
**Konsekuensi:** Latensi API–DB rendah dan dekat dengan pengguna Indonesia.

## D-023 — Konfigurasi chain opsional & peran issuer fail-closed (2026-10-04, W4)
**Konteks:** Kontrak belum di-deploy ke BSC Testnet (butuh tBNB), padahal config API gagal-cepat; mewajibkan `REGISTRY_ADDRESS` dkk. akan mematikan seluruh API di Vercel.
**Keputusan:** `ISSUER_PRIVATE_KEY`, `REGISTRY_ADDRESS`, `ISSUER_REGISTRY_ADDRESS`, `CREDENTIAL_SBT_ADDRESS` opsional tetapi divalidasi formatnya bila diisi. Tanpa alamat kontrak, `app.chain = null` dan endpoint yang butuh chain menjawab 502 `chain-unavailable`. Peran issuer (guard & `/me`) = baris `issuers.verified` **dan** `IssuerRegistry.isActive` on-chain; tanpa chain atau saat RPC error hasilnya bukan issuer (fail-closed).
**Konsekuensi:** Profil/evidence tetap jalan sebelum deploy testnet; status issuer selalu tunduk pada registry on-chain.

## D-024 — Rincian chain adapter & verifyVC (2026-10-04, W4)
**Konteks:** Spesifikasi meminta anchor idempotent yang mengembalikan data tx lama, dan `verifyVC` yang membedakan `tampered` dari `not_anchored`.
**Keputusan:** Anchor/revoke: cek `getAnchor` → jika sudah ada dari issuer yang sama, cari tx lewat event `CredentialIssued/CredentialRevoked` (scan mundur per 5.000 blok, maks 200.000 blok) tanpa tx baru; issuer/subject lain → 409 `already-anchored`. Simulasi kontrak sebelum kirim agar revert terpetakan (EXISTS 409, NOT_ACTIVE_ISSUER/NOT_ISSUER 403, NOT_FOUND 404, lain-lain 502). `verifyVC`: skema invalid atau hash ≠ `expectedHash` → `tampered`; anchor tidak ada → `tampered` bila ada proof yang gagal diverifikasi, selain itu `not_anchored`; subject/issuer/tanda tangan tidak cocok → `tampered`; lalu `revoked`, `expired`, `valid`. `credentialHash()` selalu membuang `proof`.
**Konsekuensi:** VC yang diubah satu karakter terdeteksi `tampered` walau tanpa catatan server, karena tanda tangan EIP-712 tidak lagi cocok.

## D-025 — Issuer relay dibootstrap dari env saat API start (2026-10-04, W5)
**Konteks:** Neon membuat branch DB per preview; baris `issuers` yang didaftarkan lewat `pnpm issuer:register` ke DB production tidak otomatis ada di DB preview yang dibuat lebih dulu. MVP memakai satu issuer yang kuncinya dipegang backend (§S1.3).
**Keputusan:** Bila `ISSUER_ADDRESS` + `ISSUER_NAME` di-set, `buildApp` meng-upsert baris issuer (`verified=true`, DID diturunkan dari `CHAIN_ID` + address). Config menolak start bila `ISSUER_DID` tidak cocok atau `ISSUER_PRIVATE_KEY` milik address lain. Pendaftaran on-chain tetap lewat `RegisterIssuer.s.sol` (ops `deploy-contracts`) atau `pnpm issuer:register` (ops `issuer-register`, idempotent). Peran issuer tetap mewajibkan `IssuerRegistry.isActive` (D-023).
**Konsekuensi:** Setiap preview langsung punya issuer tanpa langkah manual tambahan; otoritas tetap di registry on-chain.

## D-026 — Rincian alur issuer (2026-10-04, W5)
**Konteks:** DDL `verification_requests` tidak punya waktu dibuat maupun tempat alasan penolakan; spesifikasi tidak menyebut bukti yang sedang ditinjau atau urutan cek pada approve.
**Keputusan:** Migrasi `20261004010000_w5_request_meta` menambah `created_at` dan `decision_reason`. Bukti yang dipakai permintaan `pending` tidak bisa dihapus (409). Approve mengecek kepemilikan permintaan (404) sebelum kunci server (403) agar issuer lain tidak bisa menebak keberadaan permintaan. VC: `achievement.id = urn:uuid:{entityId}`, `statusListCredential = {APP_URL}/status/{issuerId}`, indeks status per issuer dialokasikan di bawah advisory lock. `credentials` ↔ klaim dihubungkan lewat `verification_requests.draft_credential_id`. Mint SBT (tugas opsional #10) belum dikerjakan.
**Konsekuensi:** Antrean issuer berurutan berdasarkan waktu; pengguna melihat alasan penolakan.

## D-027 — Integrasi Claude untuk AI layer (2026-10-04, W6)
**Konteks:** W6 meminta structured output "via tool use dengan tool_choice dipaksa ke satu tool". Model Claude terkini (`claude-opus-5-5`) menolak `tool_choice` `any`/`tool` dengan 400. Model juga punya safety classifier yang bisa menolak (`stop_reason: "refusal"`).
**Keputusan:** Provider `anthropic` memakai `@anthropic-ai/sdk` 0.131 → `client.beta.messages.parse` dengan `output_config.format = betaZodOutputFormat(schema)` (structured outputs, schema dari Zod v4), `output_config.effort = "low"` (target NFR-02 < 10 detik), timeout 10 detik, `maxRetries: 0` di SDK + satu retry sendiri bila output gagal validasi, dan server-side refusal fallback `fallbacks: "default"` (beta `server-side-fallback-2026-07-01`). Model default `claude-opus-5-5`, bisa diganti lewat `LLM_MODEL`. Penolakan, timeout, atau output invalid → 502 `ai-output-invalid`. Provider `mock` (deterministik) dipakai di dev, test, dan CI.
**Konsekuensi:** Tidak ada forced tool; skema tetap ditegakkan oleh API dan divalidasi ulang dengan Zod sebelum guardrail.

## D-028 — Rincian guardrail AI (2026-10-04, W6)
**Konteks:** Spesifikasi menyebut teks hasil ekstraksi PDF "bila ada" di source pack, dan skema claim-check §S10.3 tidak membawa id klaim sehingga status tidak bisa dihitung ulang.
**Keputusan:** Source pack berisi profil, 5 jenis klaim (dengan bukti tertaut), dan metadata bukti (jenis, judul, deskripsi); isi file PDF **tidak** diekstrak di MVP. Teks sumber di-escape (`<`, `>`, `&`) sehingga data tidak bisa menutup `<source>`; deskripsi lowongan dibatasi 8.000 karakter dan dibungkus sebagai data pihak ketiga. Skema claim-check model menambah `claimId`; status akhir selalu dari aturan §S10.2 (`ruleStatus`), AI hanya mengisi alasan & keyakinan; klaim tanpa bukti diberi catatan persis "Skill detected — evidence not found.". Tailoring: "matched" hanya skill milik user yang punya bukti tertaut; skill lowongan lain (dari jawaban model maupun leksikon skill umum) → "gaps" dengan catatan persis; kalimat CV yang menyebut skill gap dihapus. Klasifikasi disimpan di `ai_type/ai_confidence` sebagai saran; `evidence.type` baru berubah saat user menekan "Terapkan". Rate limit AI 10/menit per sesi.
**Konsekuensi:** Fakta yang tidak ada di data user tidak bisa lolos ke matched/CV, apa pun jawaban model (diuji dengan model mock yang mengarang dan yang menuruti prompt injection).

## D-029 — Rincian verifikasi publik & output (2026-10-04, W7)
**Konteks:** W7 meminta render server halaman verify/profil, verifikasi independen yang tidak bergantung pada API Proven, cache 30 detik, QR, dan CV PDF.
**Keputusan:** Server component memanggil API **in-process** (`createWebHandler(buildApp)` dengan `Request` internal), bukan lewat URL publik — di Vercel, fetch ke URL sendiri terhalang Deployment Protection preview. `GET /verify/:id` membaca `isRevoked` on-chain sebagai sumber kebenaran, menyinkronkan DB + audit `credential.synced` bila beda, lalu cek kedaluwarsa; cache 30 detik per instance yang dibersihkan saat revoke lewat Proven, plus `cache-control: max-age=30`. Verifikasi independen di browser memakai `@proven/vc` + viem ke `NEXT_PUBLIC_RPC_URL`, dengan alamat kontrak dari konfigurasi build (`NEXT_PUBLIC_REGISTRY_ADDRESS`), **bukan** dari respons API. `/p/[slug]` kini server-rendered (404 sungguhan untuk profil privat, metadata OpenGraph). CV PDF dibuat di browser dengan `@react-pdf/renderer` yang dimuat dinamis; item terverifikasi diberi tanda, URL, dan QR; CV AI hanya diekspor lewat tombol "Setujui & unduh PDF". Test browser memakai Playwright terhadap Next + Anvil + Postgres (job CI `e2e`).
**Konsekuensi:** Status yang ditampilkan publik selalu mengikuti chain; verifikasi tetap bisa dilakukan walau server Proven mati.

## D-030 — Kesiapan testnet, seed, dan E2E (2026-10-04, W8)
**Konteks:** W8 meminta deploy Base Sepolia (kini BSC Testnet, D-002) tanpa transaksi dengan key nyata oleh Claude, seed demo idempotent, E2E core loop dengan wagmi mock connector, dan staging terpisah (sudah tidak relevan: produksi = Vercel + Neon, D-001).
**Keputusan:** `pnpm check:env` (checklist baca-saja: RPC = chain 97, kontrak punya kode, issuer aktif, saldo tBNB, kecocokan `NEXT_PUBLIC_REGISTRY_ADDRESS`), `pnpm smoke:testnet` (baca-saja), dan `pnpm db:seed` (issuer, user demo dari `DEMO_USER_ADDRESS`, sertifikat PDF dibuat dengan pdf-lib, skill Rust tanpa bukti, satu permintaan *pending*) — ketiganya juga task `ops.yml`. Mode wallet E2E (`mock` connector wagmi → akun Anvil yang unlocked) hanya aktif bila dibuild dengan `NEXT_PUBLIC_E2E=1` **dan** chain 31337. Test "No PII on-chain" tingkat sistem membaca semua log kedua registry setelah core loop. Deploy staging terpisah tidak dibuat; panduan produksi di `docs/DEPLOY-BSC-TESTNET.md`. Seed di produksi butuh `EVIDENCE_ENC_KEY` yang sama dengan Vercel; karena nilai di Vercel Sensitive, panduan meminta membuat nilai baru dan mengisinya di kedua tempat.
**Konsekuensi:** Seluruh alur bisa diuji otomatis di CI; demo testnet hanya menunggu langkah manual user (wallet, tBNB, secrets).

## D-031 — Seed produksi lewat endpoint admin (2026-10-04)
**Konteks:** `ops → db-seed` butuh `DATABASE_URL` dan `EVIDENCE_ENC_KEY` produksi di GitHub Secrets, tetapi keduanya tersimpan Sensitive di Vercel (tidak bisa dibaca), sehingga harus dibuat ulang dan disalin ke dua tempat.
**Keputusan:** Tambah `POST /admin/seed-demo {demoUserAddress}` (wajib admin: address sesi ∈ `ADMIN_ADDRESSES`) yang menjalankan `seedDemo` di dalam deployment memakai env-nya sendiri. `ADMIN_ADDRESSES` produksi = address issuer. Task `ops → db-seed` tetap ada untuk lingkungan lain.
**Konsekuensi:** Tidak ada rahasia yang disalin; seed dipanggil dengan sesi SIWE admin.
