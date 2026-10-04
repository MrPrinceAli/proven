import { buildAchievementVC } from "./build";

/** Fixed inputs for the golden vector; changing anything here must change GOLDEN_HASH. */
export const FIXTURE_INPUT = {
  credentialId: "3f9b6c2a-1a4e-4c2b-9d1a-9c7e5b2f0a11",
  issuer: { did: "did:ethr:97:0x70997970c51812dc3a010c7d01b50e0d17dc79c8", name: "XYZ Community" },
  subjectDid: "did:ethr:97:0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc",
  achievement: {
    id: "https://xyz-community.example/achievements/hackathon-2026",
    name: "XYZ Hackathon 2026 — Winner",
    description: "First place among 120 teams.",
    criteria: "Judged first place by panel.",
  },
  validFrom: "2026-09-20T09:00:00Z",
  validUntil: "2031-09-20T09:00:00Z",
  status: { index: 42, listUrl: "https://proven.app/status/xyz/1" },
  extraTypes: ["HackathonWinner"],
} as const;

export const fixtureVC = () =>
  buildAchievementVC({ ...FIXTURE_INPUT, extraTypes: [...FIXTURE_INPUT.extraTypes] });
