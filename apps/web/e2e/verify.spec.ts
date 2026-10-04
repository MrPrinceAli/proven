import { expect, test } from "@playwright/test";
import { issueCredential } from "./api";

// §W7 9: public verification, independent verification without the Proven API, tampering, revocation, privacy.
test.describe.configure({ mode: "serial" });

const slug = `e2e-${Date.now().toString(36)}`;
let cred: Awaited<ReturnType<typeof issueCredential>>;

test.beforeAll(async () => {
  cred = await issueCredential(slug);
});

const sealOf = (page: import("@playwright/test").Page) => page.locator("[data-seal]").first();

test("an active credential shows the Aktif seal with its anchor, without logging in", async ({ page }) => {
  await page.goto(`/verify/${encodeURIComponent(cred.credentialId)}`);
  await expect(sealOf(page)).toHaveAttribute("data-seal", "active");
  await expect(sealOf(page)).toContainText("Aktif");
  await expect(page.getByTestId("anchor-tx")).toHaveText(cred.txHash);
  await expect(page.getByRole("img", { name: /Kode QR menuju halaman verifikasi/ })).toBeVisible();
});

test("independent verification works after the Proven API goes down", async ({ page }) => {
  await page.goto(`/verify/${encodeURIComponent(cred.credentialId)}`);
  // From now on every Proven API call fails; only the public RPC (Anvil) is reachable.
  await page.route("**/api/**", (route) => route.abort());
  await page.getByTestId("independent-verify").click();
  const independent = page.locator("[data-seal]").nth(1);
  await expect(independent).toHaveAttribute("data-seal", "active", { timeout: 20_000 });
  await expect(page.getByRole("list", { name: "Langkah verifikasi" }).getByTitle("gagal")).toHaveCount(0);
});

test("a VC changed by one character is reported as Tidak cocok", async ({ page, request }) => {
  const res = await request.get(`/api/verify/${encodeURIComponent(cred.credentialId)}`);
  const vc = (await res.json()).vc;

  await page.goto("/verify");
  await page.getByTestId("vc-input").fill(JSON.stringify(vc));
  await page.getByTestId("independent-verify").click();
  await expect(sealOf(page)).toHaveAttribute("data-seal", "active", { timeout: 20_000 });

  const forged = structuredClone(vc);
  forged.credentialSubject.achievement.name = forged.credentialSubject.achievement.name.replace(
    "Winner",
    "Winnex",
  );
  await page.getByTestId("vc-input").fill(JSON.stringify(forged));
  await page.getByTestId("independent-verify").click();
  await expect(sealOf(page)).toHaveAttribute("data-seal", "tampered", { timeout: 20_000 });
  await expect(sealOf(page)).toContainText("Tidak cocok");
});

test("the public profile lists the credential with a QR code and a verify link", async ({ page }) => {
  await page.goto(`/p/${slug}`);
  await expect(page.getByRole("heading", { name: "Nadia Putri" })).toBeVisible();
  await expect(page.getByText(`@${slug}`, { exact: true })).toBeVisible();
  await expect(page.getByRole("img", { name: "Foto profil Nadia Putri" })).toBeVisible();
  await expect(page.getByText("XYZ Hackathon 2026 — Winner").first()).toBeVisible();
  await expect(page.getByRole("img", { name: "Kode QR menuju profil publik Nadia Putri" })).toBeVisible();
  await page.getByRole("link", { name: "Verifikasi kredensial ini" }).click();
  await expect(sealOf(page)).toHaveAttribute("data-seal", "active");
});

test("after revocation the verify page shows Dicabut", async ({ page }) => {
  const id = cred.credentialId.replace("urn:uuid:", "");
  const revoked = await cred.issuer.call(`/issuer/credentials/${id}/revoke`, { reason: "Uji E2E" });
  expect(revoked.status).toBe(200);
  await page.goto(`/verify/${encodeURIComponent(cred.credentialId)}`);
  await expect(sealOf(page)).toHaveAttribute("data-seal", "revoked");
  await page.getByTestId("independent-verify").click();
  await expect(page.locator("[data-seal]").nth(1)).toHaveAttribute("data-seal", "revoked", {
    timeout: 20_000,
  });
});

test("a private profile answers 404", async ({ page }) => {
  await cred.user.call("/me/profile", { visibility: "private" }, "PATCH");
  const res = await page.goto(`/p/${slug}`);
  expect(res?.status()).toBe(404);
  await expect(page.getByText("Halaman tidak ditemukan")).toBeVisible();
});

test("an unknown credential shows Tidak ditemukan", async ({ page }) => {
  await page.goto(`/verify/${crypto.randomUUID()}`);
  await expect(sealOf(page)).toHaveAttribute("data-seal", "not_found");
});
