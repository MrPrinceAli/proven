/** Common skills recognised in job descriptions. Used by the mock provider and by guardrails. */
export const SKILL_LEXICON = [
  "Solidity",
  "Rust",
  "Go",
  "Golang",
  "TypeScript",
  "JavaScript",
  "Python",
  "Java",
  "Kotlin",
  "Swift",
  "C++",
  "React",
  "Next.js",
  "Vue",
  "Node.js",
  "Express",
  "NestJS",
  "Django",
  "FastAPI",
  "GraphQL",
  "REST",
  "SQL",
  "PostgreSQL",
  "MySQL",
  "MongoDB",
  "Redis",
  "Docker",
  "Kubernetes",
  "AWS",
  "GCP",
  "Azure",
  "Terraform",
  "Foundry",
  "Hardhat",
  "Ethers.js",
  "viem",
  "Web3",
  "Smart Contract",
  "DeFi",
  "NFT",
  "Zero Knowledge",
  "Machine Learning",
  "TensorFlow",
  "PyTorch",
  "Figma",
  "UI/UX",
  "Product Management",
  "Leadership",
];

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Case-insensitive whole-word match that also works for names like "C++", "Next.js" or "UI/UX". */
export function mentions(text: string, skill: string): boolean {
  return new RegExp(`(^|[^A-Za-z0-9])${escapeRegex(skill)}(?=$|[^A-Za-z0-9])`, "i").test(text);
}

export const sameSkill = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** Skills from the lexicon (plus any extra names) that a job description asks for. */
export function skillsInText(text: string, extra: string[] = []): string[] {
  const found: string[] = [];
  for (const skill of [...extra, ...SKILL_LEXICON]) {
    if (mentions(text, skill) && !found.some((f) => sameSkill(f, skill))) found.push(skill);
  }
  return found;
}
