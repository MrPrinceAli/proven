# PROGRESS — Proven

Status per gelombang. Rencana: `docs/PROVEN-WAVES.md`. Keputusan: `docs/DECISIONS.md`.

| Gelombang | Status | Branch / PR |
|---|---|---|
| W0 Fondasi Monorepo | ✅ selesai (menunggu Vercel tersambung) | `w0-monorepo-foundation` |
| W1 Smart Contracts | ⏳ belum | — |
| W2 Auth & Database | ⏳ belum | — |
| W3 Profil & Evidence | ⏳ belum | — |
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

**Tertunda**
- Gerbang preview Vercel menunggu langkah manual di bawah.

**Langkah manual untuk user**
1. vercel.com → Add New → Project → import `MrPrinceAli/proven` → **Root Directory: `apps/web`** → Deploy. Lalu Settings → General → Node.js Version **22.x**.
2. Vercel project → Storage → Create/Connect **Neon** (aktifkan preview branching) — dipakai mulai W2.
3. Settings → Environment Variables (Production + Preview): `SESSION_SECRET` (`openssl rand -hex 32`), `EVIDENCE_ENC_KEY` (`openssl rand -base64 32`) — dipakai mulai W2/W3.
4. Cek: `https://<url-vercel>/` tampil dan `https://<url-vercel>/api/health` → `{"status":"ok"}`.
