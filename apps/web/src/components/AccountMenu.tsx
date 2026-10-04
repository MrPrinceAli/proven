"use client";

import { Avatar, IconGlobe, IconHome, IconLogout, IconSearch, IconShield, IconUser } from "@proven/ui";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { avatarUri } from "@/lib/avatar";
import { useLogout, type Me } from "@/lib/session";
import { avatarLabel, displayName } from "./identity";

const ITEM =
  "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-ink hover:bg-brand-50 focus-visible:bg-brand-50";

/** Avatar button with the account menu: public profile, edit, issuer mode, the public site, logout. */
export function AccountMenu({ me }: { me: Me }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const pathname = usePathname();
  const router = useRouter();
  const logout = useLogout();

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!me.wallet) return null;
  const profile = me.profile;
  const name = displayName(profile?.displayName, profile?.slug, me.wallet.did);
  // The demo issuer reviews requests only; its account is not editable (D-035).
  const demoIssuer = Boolean(me.demo && !me.sandbox);
  const publicUrl =
    !demoIssuer && profile?.slug && profile.visibility === "public" ? `/p/${profile.slug}` : null;

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        aria-label="Menu akun"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 rounded-full p-0.5 pr-2 text-xs text-muted hover:bg-gray-100 hover:text-ink"
      >
        <Avatar
          seed={profile?.avatarSeed ?? me.wallet.address}
          label={avatarLabel(profile?.displayName, profile?.slug, me.wallet.did)}
          src={profile?.avatarSeed ? avatarUri(profile.avatarSeed) : undefined}
          size={32}
        />
        <span className="hidden sm:inline">Saya ▾</span>
      </button>

      {open && (
        <div
          id={menuId}
          role="menu"
          className="absolute right-0 top-full z-40 mt-2 w-72 rounded-2xl border border-line bg-white p-2 shadow-xl"
        >
          <div className="flex items-center gap-3 px-3 py-2">
            <Avatar
              seed={profile?.avatarSeed ?? me.wallet.address}
              label=""
              src={profile?.avatarSeed ? avatarUri(profile.avatarSeed) : undefined}
              size={44}
            />
            <div className="min-w-0">
              <p className="truncate font-semibold text-ink">{name}</p>
              <p className="truncate text-xs text-muted">{profile?.headline || "Belum ada headline"}</p>
            </div>
          </div>
          {publicUrl && (
            <Link
              role="menuitem"
              href={publicUrl}
              className="mx-3 mb-2 mt-1 block rounded-full border border-brand-700 py-1.5 text-center text-sm font-semibold text-brand-700 hover:bg-brand-50"
            >
              Lihat profil publik
            </Link>
          )}
          <div className="my-1 border-t border-line" />
          {!demoIssuer && (
            <Link role="menuitem" href="/dashboard/profile" className={ITEM}>
              <IconUser className="h-4 w-4 text-muted" /> Ubah profil
            </Link>
          )}
          {me.roles.includes("issuer") && (
            <Link role="menuitem" href="/issuer" className={ITEM}>
              <IconShield className="h-4 w-4 text-muted" /> Dashboard issuer
            </Link>
          )}
          <Link role="menuitem" href="/verify" className={ITEM}>
            <IconSearch className="h-4 w-4 text-muted" /> Verifikasi kredensial
          </Link>
          <Link role="menuitem" href="/" className={ITEM}>
            <IconHome className="h-4 w-4 text-muted" /> Halaman utama Proven-ID
          </Link>
          <Link role="menuitem" href="/#cara-kerja" className={ITEM}>
            <IconGlobe className="h-4 w-4 text-muted" /> Cara kerja
          </Link>
          <div className="my-1 border-t border-line" />
          <button
            type="button"
            role="menuitem"
            onClick={() => logout.mutate(undefined, { onSettled: () => router.push("/") })}
            className={`${ITEM} text-red-700 hover:bg-red-50`}
          >
            <IconLogout className="h-4 w-4" /> Keluar
          </button>
        </div>
      )}
    </div>
  );
}
