# CLAUDE.md — Proven

## Proyek
Proven = AI-powered verified professional identity. Mengubah klaim profesional (skill, experience,
project, achievement, community) menjadi kredensial yang bisa diverifikasi.
Rantai inti: CLAIM → EVIDENCE → VERIFICATION → CREDENTIAL + PROOF → PROVEN.
Fokus MVP: 1 user + 1 issuer + 1 achievement + 1 credential + 1 verified CV, end-to-end.
Spesifikasi lengkap & rencana kerja: docs/PROVEN-WAVES.md (Bagian B = gelombang, Bagian C = spesifikasi §S1–§S17).

## Aturan Emas (tidak boleh dilanggar)
1. NO PII ON-CHAIN. On-chain hanya bytes32 hash, address, uint, bool. Tidak ada string nama/email/isi CV.
2. AI TIDAK BOLEH MENGARANG. Tidak ada skill/experience yang tidak ada di data sumber user.
   Skill tanpa bukti ditandai persis: "Skill detected — evidence not found."
3. ISSUER ADALAH OTORITAS. AI hanya assistive; status VERIFIED hanya berasal dari kredensial yang diterbitkan issuer.
4. KUNCI PRIVAT HANYA DI SERVER. ISSUER_PRIVATE_KEY / DEPLOYER_PRIVATE_KEY tidak pernah ada di apps/web
   atau variabel NEXT_PUBLIC_*. Jangan pernah commit .env.
5. Hash kredensial deterministik: credentialHash = sha256(JCS(vc tanpa "proof")) → bytes32;
   subjectRef = sha256(utf8(credentialSubject.id)) → bytes32. Pakai util di packages/vc, jangan tulis ulang.
6. Human-in-the-loop: output AI tidak pernah tersimpan ke profil tanpa konfirmasi user.

## Stack (versi dikunci — jangan upgrade tanpa izin)
Next.js 14 (App Router) · React 18 · Tailwind 3.4 · Node 22 · TypeScript 5.4 · Fastify 4 · Prisma 5 ·
PostgreSQL 16 · viem 2.x · Reown AppKit 1.x (+ wagmi adapter) · Solidity ^0.8.24 · OpenZeppelin 5.x ·
Foundry · pnpm 9 · Turborepo 2 · Vitest · Playwright · Zod.
Jaringan: BSC Testnet 97 (demo) dan Anvil 31337 (hanya di CI/test). DID: did:ethr.

## Mode Full Cloud (lihat docs/DECISIONS.md)
Tanpa Docker, tanpa infra di laptop. GitHub Actions = CI (Postgres + Anvil di runner). Vercel = satu project
(apps/web) yang juga melayani API Fastify di /api/*. Neon = Postgres. Evidence terenkripsi di tabel Postgres, maks 4 MB.
Operasi (deploy kontrak, register issuer, seed) lewat workflow_dispatch .github/workflows/ops.yml.
Kode harus serverless-safe: tidak ada state in-process yang diandalkan antar-request (pakai DB/advisory lock).

## Struktur
apps/web (Next.js: user, issuer, verifier UI) · apps/api (Fastify REST) ·
packages/contracts (Foundry) · packages/vc (VC toolkit, isomorphic) · packages/ai (LLM + schema + guardrail) ·
packages/db (Prisma) · packages/ui (design system "Ledger & Seal": layout ala LinkedIn, tema hijau — D-012) · docs/

## Perintah
pnpm dev | pnpm build | pnpm test | pnpm lint | pnpm typecheck
pnpm db:migrate | pnpm db:seed | pnpm test:contracts | pnpm contracts:deploy:local (Anvil di CI)
Web & API satu origin: halaman di /, API di /api/* (Fastify, routes tanpa prefix).

## Konvensi
- Validasi input/output dengan Zod di setiap boundary. Env divalidasi saat startup.
- Error API: RFC 9457 (application/problem+json). Waktu: ISO 8601 UTC.
- AuthZ deny-by-default + object-level check (user hanya bisa menyentuh datanya sendiri).
- Setiap mutasi sensitif menulis audit_logs (append-only).
- Address disimpan EIP-55; DID dibentuk dari address lowercase: did:ethr:{chainId}:{address.toLowerCase()}.
- Status klaim: UNVERIFIED | EVIDENCE_ATTACHED | PENDING_ISSUER | VERIFIED | EXPIRED | REVOKED | CLAIM_WITHOUT_EVIDENCE.
- Setiap fitur wajib punya test. Target coverage ≥ 70% (services + contracts).
- Teks UI: Bahasa Indonesia, istilah teknis boleh Inggris. Aksesibilitas WCAG 2.2 AA dasar.

## Protokol Kerja per Gelombang
1. Baca bagian gelombang yang diminta di docs/PROVEN-WAVES.md beserta § spesifikasi yang dirujuk.
2. Tulis rencana singkat (file yang dibuat/diubah, urutan) sebelum menulis kode.
3. Kerjakan HANYA cakupan gelombang itu. Jangan mengerjakan gelombang berikutnya.
4. Jika spesifikasi ambigu atau bertentangan, pilih opsi paling sederhana yang memenuhi aturan emas,
   catat keputusan di docs/DECISIONS.md, dan sebutkan di laporan akhir.
5. Jalankan semua perintah Gerbang (lokal bila bisa, lalu CI di GitHub). Perbaiki sampai lulus.
6. Perbarui docs/PROGRESS.md (gelombang, apa yang selesai, apa yang tertunda, langkah manual untuk user).
7. Commit dengan pesan yang disebut di gelombang di branch wN-*, push, buka PR. Lalu BERHENTI dan laporkan
   (link PR + status CI + URL preview Vercel).
