/**
 * Example people for the showcase and demo sandboxes (D-034). Each name is paired with an illustrated
 * avatar seed (DiceBear "notionists", CC0) chosen to fit it. Fictional people.
 */
export interface Persona {
  displayName: string;
  avatarSeed: string;
}

export const SHOWCASE: Persona & { slug: string } = {
  displayName: "Arya Pratama",
  avatarSeed: "pv-0",
  slug: "arya-pratama",
};

export const PERSONAS: Persona[] = [
  { displayName: "Dimas Prasetyo", avatarSeed: "pv-32" },
  { displayName: "Bagas Wicaksono", avatarSeed: "pv-13" },
  { displayName: "Raka Aditya", avatarSeed: "pv-16" },
  { displayName: "Fajar Nugroho", avatarSeed: "pv-66" },
  { displayName: "Reza Firmansyah", avatarSeed: "pv-53" },
  { displayName: "Nadia Putri", avatarSeed: "pv-3" },
  { displayName: "Salsa Maharani", avatarSeed: "pv-44" },
  { displayName: "Ayu Lestari", avatarSeed: "pv-78" },
  { displayName: "Kirana Dewi", avatarSeed: "pv-61" },
  { displayName: "Laras Anindya", avatarSeed: "pv-42" },
  { displayName: "Intan Permata", avatarSeed: "pv-52" },
  { displayName: "Tiara Kusuma", avatarSeed: "pv-11" },
];

/** "Salsa Maharani" + "3f9a" → "salsa-maharani-3f9a" (fits the profile slug rules). */
export function personaSlug(persona: Persona, suffix: string): string {
  const base = persona.displayName
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `${base}-${suffix.toLowerCase()}`.slice(0, 40).replace(/-$/, "");
}
