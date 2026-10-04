import { describe, expect, it } from "vitest";
import { cvFromAi, cvFromProfile } from "./cv-model";
import type { ClaimsResponse, MyRequest } from "./queries";
import type { Me } from "./session";

const me: Me = {
  user: { id: "u", status: "active", createdAt: "" },
  wallet: { address: "0x1", chainId: 97, did: "did:ethr:97:0x1" },
  profile: {
    displayName: "",
    avatarSeed: "pv-1",
    headline: "Engineer",
    summary: "Halo",
    visibility: "public",
    slug: "rina",
    updatedAt: "",
  },
  roles: ["user"],
};
const claims = {
  summary: {},
  claims: {
    achievements: [
      {
        id: "a1",
        entityType: "achievement",
        title: "Juara 1",
        event: "XYZ",
        year: 2026,
        status: "VERIFIED",
        evidenceIds: [],
        createdAt: "",
      },
      {
        id: "a2",
        entityType: "achievement",
        title: "Dicabut",
        status: "REVOKED",
        evidenceIds: [],
        createdAt: "",
      },
    ],
    skills: [
      {
        id: "s1",
        entityType: "skill",
        name: "Go",
        level: null,
        status: "UNVERIFIED",
        evidenceIds: [],
        createdAt: "",
      },
    ],
    experiences: [],
    projects: [],
    community: [],
  },
} as unknown as ClaimsResponse;
const requests = [
  { id: "r1", entityType: "achievement", entityId: "a1", state: "approved", credentialId: "urn:uuid:c1" },
] as unknown as MyRequest[];

describe("CV model", () => {
  it("marks only issuer-verified claims and drops revoked ones", () => {
    const cv = cvFromProfile(me, claims, requests, "https://proven.test");
    expect(cv.name).toBe("@rina");
    const achievements = cv.sections.find((s) => s.title === "Prestasi")!;
    expect(achievements.items).toEqual([
      { text: "Juara 1", sub: "XYZ · 2026", verifyUrl: "https://proven.test/verify/urn%3Auuid%3Ac1" },
    ]);
    expect(cv.sections.find((s) => s.title === "Keahlian")!.items[0]!.verifyUrl).toBeUndefined();
  });

  it("links AI items to verification only through cited verified claims", () => {
    const cv = cvFromAi(
      me,
      {
        sections: [
          {
            title: "Prestasi",
            items: [
              { text: "Juara", citations: ["achievement:a1"] },
              { text: "Go", citations: ["skill:s1"] },
            ],
          },
        ],
      },
      claims,
      requests,
      "https://proven.test",
    );
    expect(cv.aiGenerated).toBe(true);
    expect(cv.sections[0]!.items.map((i) => Boolean(i.verifyUrl))).toEqual([true, false]);
  });
});
