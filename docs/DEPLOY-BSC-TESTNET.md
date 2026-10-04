# Deploy Proven ke BNB Smart Chain Testnet

Langkah berurutan, semuanya lewat browser (GitHub, Vercel, MetaMask) — tidak ada perintah yang perlu dijalankan di
laptop. Private key **tidak pernah** ditempel ke chat atau di-commit.

## 0. Prasyarat

- Repo `MrPrinceAli/proven` dengan semua PR gelombang sudah di-merge ke `main`.
- Project Vercel `proven` + Neon sudah tersambung (lihat `docs/PROGRESS.md`).

## 1. Dua wallet khusus testnet

Buat dua akun baru di MetaMask (atau `cast wallet new`): **deployer** dan **issuer**. Simpan private key di password manager.

## 2. tBNB

Isi kedua address dari https://www.bnbchain.org/en/testnet-faucet (± 0,3 tBNB per permintaan; faucet mensyaratkan
wallet memiliki ≥ 0,002 BNB di BSC mainnet) atau minta ke panitia hackathon. Kebutuhan: deployer ± 0,01 tBNB,
issuer ± 0,005 tBNB untuk beberapa approve/revoke.

## 3. API key verifikasi kontrak (opsional)

Buat API key di etherscan.io — Etherscan API V2 juga berlaku untuk BscScan Testnet.

## 4. GitHub Secrets

GitHub → repo → Settings → Secrets and variables → Actions → *New repository secret*:

| Secret | Isi |
|---|---|
| `DEPLOYER_PRIVATE_KEY` | private key deployer (`0x…`) |
| `ISSUER_ADDRESS` | address issuer (EIP-55, salin dari MetaMask) |
| `ISSUER_DID` | `did:ethr:97:<address issuer huruf kecil>` |
| `ISSUER_NAME` | opsional, default `XYZ Community` |
| `ETHERSCAN_API_KEY` | opsional (langkah 3) |
| `BSC_TESTNET_RPC_URL` | opsional; default RPC publik BNB Chain |

## 5. Deploy kontrak

GitHub → Actions → **ops** → *Run workflow* → `deploy-contracts`. Ringkasan run menampilkan tiga address dengan link
ke testnet.bscscan.com. Workflow juga mendaftarkan issuer di `IssuerRegistry`.

Tambahkan juga ke GitHub Secrets: `ISSUER_REGISTRY_ADDRESS`, `REGISTRY_ADDRESS` (untuk `check-env`, `issuer-register`,
`smoke-testnet`).

## 6. Vercel Environment Variables

Vercel → project `proven` → Settings → Environment Variables (Production + Preview):

| Variabel | Isi | Sensitive |
|---|---|---|
| `ISSUER_ADDRESS`, `ISSUER_NAME` | sama dengan GitHub | – |
| `ISSUER_PRIVATE_KEY` | private key **issuer** | ✅ |
| `ISSUER_REGISTRY_ADDRESS`, `REGISTRY_ADDRESS`, `CREDENTIAL_SBT_ADDRESS` | dari langkah 5 | – |
| `NEXT_PUBLIC_REGISTRY_ADDRESS` | sama dengan `REGISTRY_ADDRESS` | – |
| `ADMIN_ADDRESSES` | opsional, address kamu | – |
| `LLM_PROVIDER`, `LLM_API_KEY`, `LLM_MODEL` | opsional: `anthropic` + API key untuk AI asli | ✅ (key) |

`CHAIN_ID=97`, `RPC_URL`, `NEXT_PUBLIC_CHAIN_ID=97`, `NEXT_PUBLIC_RPC_URL`, `NEXT_PUBLIC_EXPLORER_URL`, `APP_DOMAIN`,
`APP_URL`, `SESSION_SECRET`, `EVIDENCE_ENC_KEY` dan `DATABASE_URL` sudah terisi.

Lalu **Redeploy** production (variabel `NEXT_PUBLIC_*` dibaca saat build).

## 7. Periksa

Actions → ops → `check-env` → semua ✅.

## 8. Data demo

Cara termudah (D-031): login sebagai admin (address di `ADMIN_ADDRESSES`) lalu panggil
`POST /api/admin/seed-demo` dengan `{"demoUserAddress": "<address MetaMask demo>"}` — seed berjalan di dalam Vercel.

Alternatif lewat GitHub Actions:

Butuh dua GitHub Secret tambahan: `DATABASE_URL` (connection string Neon production — Neon console → project →
Connection string) dan `EVIDENCE_ENC_KEY` (**harus sama** dengan yang di Vercel; karena di Vercel tersimpan Sensitive,
buat nilai baru dengan `openssl rand -base64 32` lalu isi di **kedua** tempat, kemudian redeploy).

Actions → ops → `db-seed`, isi `demo_user_address` dengan address MetaMask yang akan kamu pakai login saat demo.
Hasil: profil `/p/arya-pratama`, sertifikat PDF, skill Rust tanpa bukti, dan satu permintaan verifikasi *pending*.

## 9. Smoke test

Actions → ops → `smoke-testnet` (opsional: isi `demo_credential_hash` setelah approve pertama) → `isActive = true`.

## Troubleshooting

| Gejala | Solusi |
|---|---|
| `check-env`: RPC gagal | Isi `BSC_TESTNET_RPC_URL` dengan RPC ber-key (Alchemy/QuickNode/OnFinality). |
| Approve → 502 *chain-unavailable* | `ISSUER_PRIVATE_KEY` / alamat kontrak belum di Vercel, atau saldo issuer habis. |
| Menu Issuer tidak muncul | Login dengan wallet issuer; pastikan issuer aktif on-chain (`check-env`). |
| Verifikasi independen: "alamat kontrak belum dikonfigurasi" | Isi `NEXT_PUBLIC_REGISTRY_ADDRESS` lalu redeploy. |
| Unduh bukti → 409 *integrity-mismatch* | `EVIDENCE_ENC_KEY` berbeda dari saat file diunggah (lihat langkah 8). |
