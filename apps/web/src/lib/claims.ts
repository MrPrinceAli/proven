// Client-side description of the five claim kinds: labels, form fields and display.

export type EntityType = "skill" | "experience" | "project" | "achievement" | "community_role";
export type ClaimPath = "skills" | "experiences" | "projects" | "achievements" | "community";

export interface Claim {
  id: string;
  entityType: EntityType;
  status: string;
  evidenceIds: string[];
  createdAt: string;
  [field: string]: unknown;
}

/** Same as Claim, but public profiles carry only a count of evidence. */
export interface PublicClaim {
  id: string;
  entityType: EntityType;
  status: string;
  evidenceCount: number;
  [field: string]: unknown;
}

export interface FieldDef {
  name: string;
  label: string;
  kind: "text" | "textarea" | "select" | "date" | "number" | "url";
  required?: boolean;
  placeholder?: string;
  options?: { value: string; label: string }[];
}

export interface KindDef {
  path: ClaimPath;
  entityType: EntityType;
  title: string;
  singular: string;
  empty: string;
  fields: FieldDef[];
  primary(c: Record<string, unknown>): string;
  secondary(c: Record<string, unknown>): string | null;
}

export const SKILL_LEVELS = [
  { value: "", label: "—" },
  { value: "beginner", label: "Pemula" },
  { value: "intermediate", label: "Menengah" },
  { value: "advanced", label: "Mahir" },
  { value: "expert", label: "Ahli" },
];

const levelLabel = (v: unknown) => SKILL_LEVELS.find((l) => l.value === v)?.label ?? null;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
export function formatMonth(ymd: unknown): string | null {
  if (typeof ymd !== "string" || !/^\d{4}-\d{2}/.test(ymd)) return null;
  const [y, m] = ymd.split("-");
  return `${MONTHS[Number(m) - 1]} ${y}`;
}

const join = (...parts: (string | null | undefined)[]) => parts.filter(Boolean).join(" · ") || null;

export const KINDS: KindDef[] = [
  {
    path: "experiences",
    entityType: "experience",
    title: "Pengalaman",
    singular: "pengalaman",
    empty: "Tambahkan pekerjaan, magang, atau peran profesional.",
    fields: [
      {
        name: "title",
        label: "Jabatan",
        kind: "text",
        required: true,
        placeholder: "Smart Contract Engineer",
      },
      { name: "org", label: "Organisasi", kind: "text", required: true, placeholder: "XYZ Labs" },
      { name: "startDate", label: "Mulai", kind: "date" },
      { name: "endDate", label: "Selesai", kind: "date" },
      { name: "description", label: "Deskripsi", kind: "textarea" },
    ],
    primary: (c) => String(c.title ?? ""),
    secondary: (c) =>
      join(
        String(c.org ?? ""),
        c.startDate ? `${formatMonth(c.startDate)} – ${formatMonth(c.endDate) ?? "sekarang"}` : null,
      ),
  },
  {
    path: "projects",
    entityType: "project",
    title: "Proyek",
    singular: "proyek",
    empty: "Tunjukkan proyek yang pernah kamu bangun.",
    fields: [
      { name: "name", label: "Nama proyek", kind: "text", required: true },
      { name: "url", label: "URL", kind: "url", placeholder: "https://" },
      { name: "description", label: "Deskripsi", kind: "textarea" },
    ],
    primary: (c) => String(c.name ?? ""),
    secondary: (c) => (c.url ? String(c.url) : null),
  },
  {
    path: "achievements",
    entityType: "achievement",
    title: "Prestasi",
    singular: "prestasi",
    empty: "Juara lomba, hackathon, penghargaan, atau sertifikasi.",
    fields: [
      {
        name: "title",
        label: "Prestasi",
        kind: "text",
        required: true,
        placeholder: "XYZ Hackathon 2026 — Winner",
      },
      { name: "event", label: "Acara", kind: "text", placeholder: "XYZ Hackathon 2026" },
      { name: "year", label: "Tahun", kind: "number" },
    ],
    primary: (c) => String(c.title ?? ""),
    secondary: (c) => join(c.event ? String(c.event) : null, c.year ? String(c.year) : null),
  },
  {
    path: "skills",
    entityType: "skill",
    title: "Keahlian",
    singular: "keahlian",
    empty: "Tambahkan keahlian lalu lampirkan bukti untuk tiap keahlian.",
    fields: [
      { name: "name", label: "Keahlian", kind: "text", required: true, placeholder: "Solidity" },
      { name: "level", label: "Level", kind: "select", options: SKILL_LEVELS },
    ],
    primary: (c) => String(c.name ?? ""),
    secondary: (c) => levelLabel(c.level),
  },
  {
    path: "community",
    entityType: "community_role",
    title: "Komunitas",
    singular: "peran komunitas",
    empty: "Peran di komunitas, organisasi, atau kegiatan sukarela.",
    fields: [
      { name: "community", label: "Komunitas", kind: "text", required: true, placeholder: "BNB Builders ID" },
      { name: "role", label: "Peran", kind: "text", placeholder: "Mentor" },
    ],
    primary: (c) => String(c.community ?? ""),
    secondary: (c) => (c.role ? String(c.role) : null),
  },
];

export const KIND_BY_TYPE = Object.fromEntries(KINDS.map((k) => [k.entityType, k])) as Record<
  EntityType,
  KindDef
>;

/** Form strings → API payload: empty optional fields become null, numbers become numbers. */
export function toPayload(kind: KindDef, values: Record<string, string>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const f of kind.fields) {
    const raw = (values[f.name] ?? "").trim();
    if (raw === "") {
      if (!f.required) out[f.name] = null;
      continue;
    }
    out[f.name] = f.kind === "number" ? Number(raw) : raw;
  }
  return out;
}

/** Claim → form strings for editing. */
export function toFormValues(kind: KindDef, claim?: Record<string, unknown>): Record<string, string> {
  return Object.fromEntries(
    kind.fields.map((f) => {
      const v = claim?.[f.name];
      return [f.name, v === null || v === undefined ? "" : String(v)];
    }),
  );
}

/** Only these statuses may be edited (D-020). */
export const isEditable = (status: string) => status === "UNVERIFIED" || status === "EVIDENCE_ATTACHED";

export const EVIDENCE_TYPES = [
  { value: "certificate", label: "Sertifikat" },
  { value: "award", label: "Penghargaan" },
  { value: "hackathon", label: "Hackathon" },
  { value: "competition", label: "Kompetisi" },
  { value: "project", label: "Proyek" },
  { value: "community", label: "Komunitas" },
  { value: "employment", label: "Pekerjaan" },
  { value: "education", label: "Pendidikan" },
];

export function formatBytes(n: number | null): string {
  if (n === null) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
