import { Avatar, Badge, Card, IconGlobe, IconLock, IconPencil } from "@proven/ui";
import Link from "next/link";
import { avatarUri } from "@/lib/avatar";
import { shortDid } from "@/lib/chains";
import { avatarLabel, displayName } from "./identity";

const VISIBILITY = {
  public: { label: "Publik", icon: IconGlobe },
  private: { label: "Privat", icon: IconLock },
  "recruiter-only": { label: "Khusus recruiter", icon: IconLock },
} as const;

export function ProfileHeader({
  name,
  slug,
  headline,
  did,
  avatarSeed,
  visibility,
  onEdit,
}: {
  name: string;
  slug: string | null;
  headline: string;
  /** Full DID for the owner, already-truncated DID on public pages. */
  did: string | null;
  avatarSeed: string | null;
  visibility?: keyof typeof VISIBILITY;
  onEdit?: () => void;
}) {
  const vis = visibility ? VISIBILITY[visibility] : null;
  const publicUrl = slug && visibility === "public" ? `/p/${slug}` : null;

  return (
    <Card className="overflow-hidden">
      <div className="h-24 bg-gradient-to-r from-brand-700 via-brand-800 to-brand-900 sm:h-32" />
      <div className="relative px-5 pb-5">
        <div className="-mt-12 flex items-end justify-between sm:-mt-14">
          <Avatar
            seed={avatarSeed ?? slug ?? did ?? "proven"}
            label={avatarLabel(name, slug, did)}
            src={avatarSeed ? avatarUri(avatarSeed) : undefined}
            size={96}
          />
          {onEdit && (
            <button
              type="button"
              onClick={onEdit}
              aria-label="Ubah profil"
              className="rounded-full p-2 text-muted hover:bg-gray-100 hover:text-ink"
            >
              <IconPencil className="h-5 w-5" />
            </button>
          )}
        </div>
        <h1 className="mt-3 text-2xl font-semibold text-ink">{displayName(name, slug, did)}</h1>
        {name && slug && <p className="text-sm text-muted">@{slug}</p>}
        <p className="mt-1 text-ink">{headline || (onEdit ? "Tambahkan headline profesional kamu" : "")}</p>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted">
          {did && (
            <span className="font-mono text-xs" title={did}>
              {did.includes("…") ? did : shortDid(did)}
            </span>
          )}
          {vis && (
            <Badge>
              <vis.icon className="h-3.5 w-3.5" />
              {vis.label}
            </Badge>
          )}
          {onEdit && publicUrl && (
            <Link href={publicUrl} className="text-sm font-medium text-brand-700 hover:underline">
              Lihat profil publik
            </Link>
          )}
        </div>
      </div>
    </Card>
  );
}
