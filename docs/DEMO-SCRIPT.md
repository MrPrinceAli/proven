# Naskah demo Proven — 3 menit

**Persiapan (sebelum naik panggung, checklist §S16):** `docs/DEPLOY-BSC-TESTNET.md` selesai; `ops → check-env` ✅;
`ops → db-seed` sudah dijalankan dengan address MetaMask kamu; dua profil MetaMask siap (user demo & issuer) di BNB Smart
Chain Testnet; saldo tBNB issuer cukup; tab terbuka: landing, `/issuer` (login issuer), testnet.bscscan.com; HP siap
scan QR. Cadangan: video rekaman alur yang sama.

| Waktu | Layar | Narasi |
|---|---|---|
| 0:00 | Landing | "Siapa pun bisa *mengaku* punya skill. CV bisa diedit, sertifikat bisa difoto ulang. **Proven** membuat klaim profesional bisa *dibuktikan* — Create, Prove, Share." |
| 0:15 | Login MetaMask → dashboard | "Login cukup tanda tangan wallet — gratis, tanpa transaksi. Identitasku `did:ethr:97:…`." |
| 0:30 | Profil `/dashboard/profile` | "Profil seperti LinkedIn, tapi tiap klaim punya status: *Belum diverifikasi → Ada bukti → Menunggu issuer → Terverifikasi*. Prestasi 'XYZ Hackathon 2026 — Winner' sudah *Menunggu issuer*." |
| 0:45 | Evidence | "Buktinya sertifikat PDF. Proven menyimpan sidik jari SHA-256-nya dan mengenkripsi file — isi file tidak pernah masuk blockchain." |
| 1:00 | Asisten AI → tempel lowongan "Rust & Solidity engineer" | "AI hanya memakai data dan buktiku. Solidity cocok dan terbukti; Rust: *Skill detected — evidence not found.* AI tidak menambah skill, dan tidak bisa memberi status Terverifikasi." |
| 1:25 | Ganti ke tab issuer `/issuer` | "Issuer XYZ Community terdaftar di IssuerRegistry on-chain. Ia melihat klaim, membuka bukti, mendapat saran AI — tapi keputusan di tangan issuer." |
| 1:40 | Klik **Setujui & terbitkan** | "Proven membangun Verifiable Credential W3C, meng-hash-nya, dan mencatat hash itu ke BNB Smart Chain. *Mencatat ke blockchain…* — selesai, ini tx-nya." (buka BscScan) |
| 2:00 | Kredensial user → halaman verifikasi | "Recruiter cukup buka link atau scan QR ini." (scan dari HP) "**Aktif**, issuer, pemilik, transaksi, blok." |
| 2:15 | Klik **Verifikasi independen** | "Ini tidak percaya pada server kami: browser menghitung ulang hash, membaca kontrak langsung dari RPC publik, dan memeriksa tanda tangan issuer. Server Proven mati pun tetap bisa diverifikasi." |
| 2:30 | `/verify` → tempel VC, ubah satu huruf | "Ubah satu huruf saja… **Tidak cocok**." |
| 2:40 | Issuer → Kredensial → **Cabut** → refresh verify | "Kalau ternyata sertifikatnya palsu, issuer mencabutnya — statusnya langsung **Dicabut**, di chain dan di halaman verifikasi." |
| 2:50 | Penutup | "Blockchain hanya menyimpan bukti bahwa sesuatu terjadi — bukan data pribadimu. **Anyone can claim a skill. Proven lets you prove it.**" |

**Cadangan bila jaringan bermasalah:** halaman `/verify` tetap menampilkan status dari catatan server (dengan peringatan),
dan video demo. Bila approve gagal, permintaan tetap *pending* dan bisa diulang tanpa anchor ganda.
