"use client";

import { IconCheckBadge, IconFile } from "@proven/ui";
import { useEffect, useRef, type CSSProperties } from "react";
import { Qr } from "@/components/Qr";
import { site } from "@/lib/site";

/**
 * "Cara kerja" as a scroll-driven, full-screen story (Create → Prove → Share). The section is
 * tall; a sticky stage stays on screen while scroll progress is written into CSS variables
 * (--l1, --t2, --l2, --t3, --l3). Only transform/opacity/clip-path animate, so scrolling stays smooth.
 * With prefers-reduced-motion the three scenes simply stack (see globals.css `.immersive`).
 */

const clamp = (v: number) => Math.min(1, Math.max(0, v));

/** `clamp(0, (var - from) / span, 1)` as a CSS expression. */
const seg = (v: string, from: number, span: number) => `clamp(0, (var(${v}) - ${from}) / ${span}, 1)`;

const reveal = (v: string, from: number, span: number): CSSProperties => ({
  opacity: seg(v, from, span),
  transform: `translateY(calc((1 - ${seg(v, from, span)}) * 18px))`,
});

const wipe = (v: string, from: number, span: number): CSSProperties => ({
  clipPath: `inset(0 calc((1 - ${seg(v, from, span)}) * 100%) 0 0)`,
});

const STEPS = ["Create", "Prove", "Share"] as const;

export function HowItWorks() {
  const section = useRef<HTMLElement>(null);
  const stage = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = section.current;
    const st = stage.current;
    if (!el || !st) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let frame = 0;
    const set = (p: number) => {
      const vars = {
        "--p": p,
        "--l1": reduced ? 1 : clamp(p / 0.28),
        "--t2": reduced ? 1 : clamp((p - 0.3) / 0.08),
        "--l2": reduced ? 1 : clamp((p - 0.37) / 0.26),
        "--t3": reduced ? 1 : clamp((p - 0.64) / 0.08),
        "--l3": reduced ? 1 : clamp((p - 0.71) / 0.24),
      };
      for (const [k, v] of Object.entries(vars)) st.style.setProperty(k, v.toFixed(4));
      st.dataset.step = p < 0.34 ? "1" : p < 0.68 ? "2" : "3";
    };
    const update = () => {
      frame = 0;
      const rect = el.getBoundingClientRect();
      const total = el.offsetHeight - window.innerHeight;
      set(total > 0 ? clamp(-rect.top / total) : 1);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <section
      ref={section}
      id="cara-kerja"
      aria-labelledby="cara-kerja-title"
      className="immersive relative h-[340vh]"
    >
      <h2 id="cara-kerja-title" className="sr-only">
        Cara kerja: Create, Prove, Share
      </h2>
      <div
        ref={stage}
        data-step="1"
        className="immersive-stage group sticky top-0 h-[100svh] overflow-hidden"
      >
        <SceneCreate />
        <SceneProve />
        <SceneShare />

        {/* progress rail */}
        <div
          aria-hidden
          className="immersive-rail pointer-events-none absolute bottom-5 left-1/2 z-20 flex -translate-x-1/2 items-center gap-1 rounded-full bg-brand-950/85 p-1 text-xs font-semibold text-white/60 shadow-xl ring-1 ring-white/10 backdrop-blur"
        >
          {STEPS.map((s, i) => (
            <span
              key={s}
              className={`whitespace-nowrap rounded-full px-3 py-1.5 transition-colors ${
                [
                  "group-data-[step=1]:bg-white group-data-[step=1]:text-brand-950",
                  "group-data-[step=2]:bg-emerald-400 group-data-[step=2]:text-brand-950",
                  "group-data-[step=3]:bg-white group-data-[step=3]:text-brand-950",
                ][i]
              }`}
            >
              0{i + 1} {s}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── 01 · Create — paper & ink, editorial ─────────────────────────────── */

function SceneCreate() {
  return (
    <div className="immersive-scene absolute inset-0 overflow-hidden bg-[#F6F1E7] text-brand-950">
      <div
        aria-hidden
        className="absolute inset-0 bg-[repeating-linear-gradient(to_bottom,transparent_0,transparent_39px,rgb(4_120_87/0.09)_40px)]"
      />
      <div aria-hidden className="absolute inset-y-0 left-[8%] w-px bg-rose-300/60" />
      <span
        aria-hidden
        className="absolute -bottom-[6vh] right-[2vw] select-none font-display text-[38vh] leading-none text-transparent [-webkit-text-stroke:1.5px_rgb(4_120_87/0.25)]"
        style={{ transform: "translateY(calc((1 - var(--l1)) * 12vh))" }}
      >
        01
      </span>

      <div className="relative mx-auto grid h-full max-w-6xl content-center gap-8 px-4 pb-16 sm:px-6 lg:grid-cols-2 lg:gap-16">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-brand-700">Langkah 01 · Create</p>
          <h3 className="mt-4 font-display text-5xl leading-[0.95] sm:text-6xl lg:text-7xl">
            Tulis klaimmu.
            <br />
            <em className="text-brand-700">Lampirkan buktinya.</em>
          </h3>
          <p className="mt-5 max-w-md text-sm leading-relaxed text-brand-950/70 sm:text-base">
            Prestasi, pengalaman, keahlian — semuanya dimulai sebagai klaim. File bukti dienkripsi, dan sidik
            jarinya (SHA-256) dicatat sebagai rantai bukti.
          </p>
        </div>

        <div aria-hidden className="relative mx-auto w-full max-w-md">
          <div
            className="rounded-2xl bg-white p-5 shadow-[0_30px_60px_-20px_rgb(2_44_34/0.35)] ring-1 ring-black/5 sm:p-6"
            style={{ transform: "rotate(-2deg) translateY(calc((1 - var(--l1)) * 40px))" }}
          >
            <div className="flex items-center justify-between border-b border-dashed border-brand-950/15 pb-3">
              <span className="font-display text-2xl italic">Klaim baru</span>
              <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold text-amber-900">
                Belum diverifikasi
              </span>
            </div>
            <dl className="mt-4 space-y-3 text-sm">
              <div style={reveal("--l1", 0.05, 0.12)}>
                <dt className="text-xs text-brand-950/50">Jenis</dt>
                <dd className="font-semibold">Prestasi</dd>
              </div>
              <div>
                <dt className="text-xs text-brand-950/50" style={reveal("--l1", 0.12, 0.1)}>
                  Judul
                </dt>
                <dd className="font-semibold" style={wipe("--l1", 0.18, 0.22)}>
                  XYZ Hackathon 2026 — Winner
                </dd>
              </div>
            </dl>

            <div className="mt-4 rounded-xl border-2 border-dashed border-brand-700/30 bg-brand-50/50 p-3">
              <div
                className="flex items-center gap-3 rounded-lg bg-white p-2.5 shadow-sm ring-1 ring-black/5"
                style={{
                  opacity: seg("--l1", 0.4, 0.1),
                  transform: `translateX(calc((1 - ${seg("--l1", 0.4, 0.25)}) * 140%)) rotate(calc((1 - ${seg("--l1", 0.4, 0.25)}) * 8deg))`,
                }}
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-md bg-rose-50 text-rose-600">
                  <IconFile className="h-5 w-5" />
                </span>
                <span className="min-w-0 text-xs">
                  <span className="block truncate font-semibold">sertifikat-juara.pdf</span>
                  <span className="text-brand-950/50">212 KB · terenkripsi AES-256</span>
                </span>
              </div>
            </div>

            <div className="mt-4">
              <p className="text-xs text-brand-950/50" style={reveal("--l1", 0.66, 0.08)}>
                SHA-256
              </p>
              <p
                className="break-all font-mono text-[11px] leading-relaxed text-brand-800"
                style={wipe("--l1", 0.7, 0.2)}
              >
                9f2c4e1a7b03d58e6c21f0a94b7d3e58c1a26f09e4b7d2c8a15f3e60b9d74c21
              </p>
            </div>
          </div>

          <div
            className="absolute -right-2 -top-5 rotate-6 rounded-full border-2 border-brand-700 bg-[#F6F1E7] px-3 py-1.5 font-mono text-[11px] font-bold uppercase tracking-wider text-brand-700"
            style={{
              opacity: seg("--l1", 0.9, 0.08),
              transform: `rotate(6deg) scale(calc(1.6 - ${seg("--l1", 0.9, 0.08)} * 0.6))`,
            }}
          >
            Sidik jari tercatat
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── 02 · Prove — the machine room: dark, neon, on-chain ────────────────── */

const LOG = [
  ["issuer", "XYZ Community memeriksa bukti"],
  ["verify", "EIP712(signature)  ✓ valid"],
  ["hash", "credentialHash = 0x7f3a…9c1e"],
  ["anchor", "CredentialRegistry.anchor() → tx 0x51c4…0e09"],
  ["status", "ACTIVE · BNB Smart Chain #97"],
];

function SceneProve() {
  return (
    <div
      className="immersive-scene absolute inset-0 overflow-hidden bg-[#020F0B] text-white"
      style={{ clipPath: "circle(calc(var(--t2) * 150%) at 50% 50%)" }}
    >
      {/* perspective floor */}
      <div aria-hidden className="absolute inset-x-[-50%] bottom-[-10%] h-[70%] [perspective:500px]">
        <div
          className="bg-grid h-full w-full opacity-70 [transform:rotateX(62deg)]"
          style={{ backgroundPosition: "0 calc(var(--l2) * 560px)" }}
        />
      </div>
      <div
        aria-hidden
        className="absolute left-1/2 top-[45%] h-[60vh] w-[60vh] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(closest-side,rgb(16_185_129/0.28),transparent)]"
      />

      <div className="relative mx-auto grid h-full max-w-6xl content-center gap-8 px-4 pb-16 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:gap-14">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-emerald-400">02 / Prove</p>
          <h3 className="mt-4 text-4xl font-extrabold uppercase leading-[0.95] tracking-tight sm:text-5xl lg:text-6xl">
            Issuer
            <br />
            memeriksa.
            <br />
            <span className="bg-gradient-to-r from-emerald-300 to-teal-200 bg-clip-text text-transparent">
              Chain mencatat.
            </span>
          </h3>
          <p className="mt-5 max-w-md text-sm leading-relaxed text-white/60 sm:text-base">
            Issuer terdaftar menandatangani kredensial W3C. Hanya hash-nya yang masuk BNB Smart Chain — tanpa
            data pribadi.
          </p>
        </div>

        <div aria-hidden className="relative">
          {/* block chain */}
          <div className="flex gap-3" style={{ transform: "translateX(calc((1 - var(--l2)) * 30% - 10%))" }}>
            {[48213004, 48213005, 48213006, 48213007].map((n, i) => (
              <div
                key={n}
                className={`relative flex h-20 w-28 shrink-0 flex-col justify-between rounded-xl border p-2.5 font-mono text-[10px] sm:h-24 sm:w-32 ${
                  i === 3
                    ? "border-emerald-400 bg-emerald-400/10"
                    : "border-white/10 bg-white/[0.03] text-white/40"
                }`}
                style={
                  i === 3
                    ? { boxShadow: `0 0 calc(${seg("--l2", 0.5, 0.2)} * 40px) rgb(52 211 153 / 0.5)` }
                    : undefined
                }
              >
                <span>#{n.toLocaleString("id-ID")}</span>
                <span className="flex gap-0.5">
                  {Array.from({ length: 6 }).map((_, k) => (
                    <span
                      key={k}
                      className={`h-1.5 flex-1 rounded-sm ${i === 3 ? "bg-emerald-400/70" : "bg-white/15"}`}
                    />
                  ))}
                </span>
                {i < 3 && <span className="absolute -right-3 top-1/2 h-px w-3 bg-white/20" />}
              </div>
            ))}
          </div>

          {/* terminal */}
          <div className="mt-6 rounded-2xl border border-white/10 bg-black/50 p-4 font-mono text-[11px] leading-6 sm:text-xs">
            <div className="mb-2 flex gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
              <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/70" />
            </div>
            {LOG.map(([k, v], i) => (
              <p key={k} className="truncate" style={reveal("--l2", 0.08 + i * 0.13, 0.08)}>
                <span className="text-emerald-400">❯ {k.padEnd(6, " ")}</span>{" "}
                <span className="text-white/80">{v}</span>
              </p>
            ))}
          </div>

          {/* rubber stamp */}
          <div
            className="absolute -top-20 right-2 rounded-lg border-[3px] bg-[#020F0B]/80 border-emerald-400 px-4 py-2 text-center font-mono font-bold uppercase text-emerald-300 sm:right-6"
            style={{
              opacity: seg("--l2", 0.45, 0.06),
              transform: `rotate(-10deg) scale(calc(2.4 - ${seg("--l2", 0.45, 0.1)} * 1.4))`,
            }}
          >
            <span className="block text-lg leading-none tracking-widest sm:text-xl">Disetujui</span>
            <span className="text-[10px] tracking-wider text-emerald-300/70">XYZ Community · EIP-712</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── 03 · Share — glass & light: fresh, bright, social ──────────────────── */

const ORBIT = ["Rekruter", "Kampus", "Klien", "Komunitas"];

function SceneShare() {
  return (
    <div
      className="immersive-scene absolute inset-0 overflow-hidden bg-[#E9FBF3] text-brand-950"
      style={{ clipPath: "inset(calc((1 - var(--t3)) * 100%) 0 0 0)" }}
    >
      <div
        aria-hidden
        className="absolute inset-0 bg-[radial-gradient(40%_50%_at_15%_20%,rgb(52_211_153/0.45),transparent),radial-gradient(35%_45%_at_85%_30%,rgb(163_230_53/0.35),transparent),radial-gradient(45%_50%_at_60%_95%,rgb(20_184_166/0.35),transparent)]"
      />

      <div className="relative mx-auto grid h-full max-w-6xl content-center gap-6 px-4 pb-16 sm:px-6 lg:grid-cols-2 lg:gap-16">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-brand-700">Langkah 03 · Share</p>
          <h3 className="mt-4 text-4xl font-bold leading-[1.02] tracking-tight sm:text-5xl lg:text-6xl">
            Bagikan sekali.
            <br />
            <em className="font-display font-normal text-brand-700">Dipercaya di mana saja.</em>
          </h3>
          <p className="mt-5 max-w-md text-sm leading-relaxed text-brand-950/70 sm:text-base">
            Profil publik, QR, atau CV PDF. Siapa pun bisa memverifikasi langsung dari blockchain — bahkan
            tanpa server Proven-ID.
          </p>
        </div>

        <div
          aria-hidden
          className="relative mx-auto flex h-[22rem] w-full max-w-md items-center justify-center sm:h-[28rem]"
        >
          {/* orbit */}
          <div
            className="absolute inset-0 m-auto h-[20rem] w-[20rem] rounded-full border border-dashed border-brand-700/25 sm:h-[26rem] sm:w-[26rem]"
            style={{ transform: "rotate(calc(var(--l3) * 140deg))" }}
          >
            {ORBIT.map((label, i) => (
              <span
                key={label}
                className="absolute left-1/2 top-1/2 -ml-12 -mt-4 flex h-8 w-24 items-center justify-center rounded-full bg-white/80 text-xs font-semibold text-brand-800 shadow-lg ring-1 ring-brand-700/10 backdrop-blur"
                style={{
                  transform: `rotate(${i * 90 + 45}deg) translateY(calc(-1 * min(13rem, 40vw))) rotate(calc(${-(i * 90 + 45)}deg - var(--l3) * 140deg))`,
                }}
              >
                {label}
              </span>
            ))}
          </div>

          {/* phone */}
          <div
            className="relative w-48 rounded-[2.2rem] border-[6px] border-brand-950 bg-white p-3 shadow-[0_40px_80px_-30px_rgb(2_44_34/0.6)] sm:w-56"
            style={{
              transform: "translateY(calc((1 - var(--l3)) * 60%)) rotate(calc((1 - var(--l3)) * -6deg))",
            }}
          >
            <div className="mx-auto mb-2 h-1.5 w-12 rounded-full bg-brand-950/15" />
            <div className="h-14 rounded-xl bg-gradient-to-r from-brand-700 to-emerald-400" />
            <div className="-mt-6 ml-3 h-12 w-12 rounded-full bg-gradient-to-br from-emerald-200 to-teal-500 ring-4 ring-white" />
            <p className="mt-1.5 text-sm font-bold">Profil terverifikasi</p>
            <p className="text-[10px] text-muted">Smart Contract Engineer</p>
            <div className="mt-2 flex items-center gap-1.5 rounded-lg bg-brand-50 px-2 py-1.5 text-[10px] font-semibold text-brand-800">
              <IconCheckBadge className="h-3.5 w-3.5" /> Terverifikasi · on-chain
            </div>
            <div className="mt-3 flex justify-center">
              <Qr value={`/p/${site.showcaseSlug}`} label="contoh profil" size={104} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
