import { credentialRegistryAbi, issuerRegistryAbi } from "@proven/contracts";
import { expect, test, type Page } from "@playwright/test";
import { createPublicClient, decodeEventLog, http, stringToHex, type Abi, type AbiEvent } from "viem";
import { foundry } from "viem/chains";
import { ACCOUNTS, e2eEnv } from "./env";

// §W8 3: the whole Proven loop driven through the UI with a mock wallet on Anvil, then §W8 5 (No PII on-chain).
test.describe.configure({ mode: "serial" });

const stamp = Date.now().toString(36);
const TITLE = `E2E Hackathon ${stamp} — Winner`;
let credentialUrl = "";

async function loginAs(page: Page, account: string) {
  await page.addInitScript((a) => window.localStorage.setItem("proven:e2e-account", a), account);
  await page.goto("/");
  const dashboard = page.getByRole("link", { name: "Buka dashboard" });
  if (await dashboard.isVisible().catch(() => false)) {
    // A session from the previous account is still active: log out first.
    await dashboard.click();
    await page.getByRole("button", { name: "Keluar" }).click();
    await page.waitForURL("/");
  }
  await page.getByRole("button", { name: "Masuk dengan wallet" }).click();
  await page.waitForURL("**/dashboard");
}

async function logout(page: Page) {
  await page.getByRole("button", { name: "Keluar" }).click();
  await page.waitForURL("/");
}

test("user: claim → evidence → link → request verification", async ({ page }) => {
  await loginAs(page, ACCOUNTS.user);
  const me = await (await page.request.get("/api/me")).json();
  expect(me.wallet.did).toBe(`did:ethr:31337:${ACCOUNTS.user.toLowerCase()}`);

  await page.goto("/dashboard/profile");
  await page.getByRole("button", { name: "Tambah prestasi" }).click();
  const form = page.getByRole("dialog");
  await form.getByLabel("Prestasi").fill(TITLE);
  await form.getByLabel("Acara").fill("XYZ Hackathon 2026");
  await form.getByLabel("Tahun").fill("2026");
  await form.getByRole("button", { name: "Simpan" }).click();
  const item = page.getByRole("listitem").filter({ hasText: TITLE });
  await expect(item.getByText("Belum diverifikasi")).toBeVisible();

  await page.goto("/dashboard/evidence");
  await page.locator('input[type="file"]').setInputFiles({
    name: "sertifikat-e2e.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from(`%PDF-1.4\nE2E ${stamp}\n%%EOF\n`),
  });
  await page.getByRole("button", { name: "Unggah", exact: true }).click();
  const card = page.locator("section").filter({ hasText: "sertifikat-e2e.pdf" }).first();
  await expect(card.getByText("SHA-256")).toBeVisible();
  await card.getByLabel("Pilih klaim").selectOption({ label: `Prestasi: ${TITLE}` });
  await card.getByRole("button", { name: "Tautkan" }).click();
  await expect(card.getByText("Ada bukti")).toBeVisible();

  await page.goto("/dashboard/profile");
  await item.getByRole("button", { name: "Minta verifikasi" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Kirim permintaan" }).click();
  await expect(item.getByText("Menunggu issuer")).toBeVisible();
  await logout(page);
});

test("issuer: approve → credential anchored on-chain", async ({ page }) => {
  await loginAs(page, ACCOUNTS.issuer);
  await page.getByRole("link", { name: "Issuer" }).first().click();
  await page.getByRole("button", { name: new RegExp(TITLE) }).click();
  await expect(page.getByText("SHA-256").first()).toBeVisible();
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Setujui & terbitkan" }).click();
  await expect(page.getByText(/Kredensial terbit/)).toBeVisible({ timeout: 30_000 });
  await logout(page);
});

test("user: sees VERIFIED and the public verify page says Aktif", async ({ page }) => {
  await loginAs(page, ACCOUNTS.user);
  await page.goto("/dashboard/profile");
  await expect(
    page.getByRole("listitem").filter({ hasText: TITLE }).getByText("Terverifikasi"),
  ).toBeVisible();

  await page.goto("/dashboard/credentials");
  const credential = page.locator("section").filter({ hasText: TITLE }).first();
  await expect(credential.getByText("Terverifikasi")).toBeVisible();
  credentialUrl = (await credential
    .getByRole("link", { name: "Halaman verifikasi publik" })
    .getAttribute("href"))!;
  await logout(page);

  await page.goto(credentialUrl);
  await expect(page.locator("[data-seal]").first()).toHaveAttribute("data-seal", "active");
  await page.getByTestId("independent-verify").click();
  await expect(page.locator("[data-seal]").nth(1)).toHaveAttribute("data-seal", "active", {
    timeout: 20_000,
  });
});

test("issuer: revoke → the verify page says Dicabut", async ({ page }) => {
  await loginAs(page, ACCOUNTS.issuer);
  await page.goto("/issuer");
  await page.getByRole("tab", { name: "Kredensial" }).click();
  await page
    .locator("section")
    .filter({ hasText: TITLE })
    .first()
    .getByRole("button", { name: "Cabut" })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Alasan pencabutan").fill("Uji pencabutan E2E");
  await dialog.getByRole("button", { name: "Cabut" }).click();
  await expect(page.getByText("Kredensial dicabut dan tercatat on-chain")).toBeVisible({ timeout: 30_000 });
  await logout(page);

  await page.goto(credentialUrl);
  await expect(page.locator("[data-seal]").first()).toHaveAttribute("data-seal", "revoked");
});

test("No PII on-chain: every registry event carries only bytes32/address/uint/bool", async () => {
  const client = createPublicClient({ chain: foundry, transport: http(e2eEnv.RPC_URL) });
  const abi = [...credentialRegistryAbi, ...issuerRegistryAbi] as Abi;
  const logs = await client.getLogs({
    address: [e2eEnv.REGISTRY_ADDRESS as `0x${string}`, e2eEnv.ISSUER_REGISTRY_ADDRESS as `0x${string}`],
    fromBlock: 0n,
  });
  expect(logs.length).toBeGreaterThan(0);

  const allowed = /^(bytes32|address|bool|uint\d+)$/;
  const userDid = `did:ethr:31337:${ACCOUNTS.user.toLowerCase()}`;
  // Readable personal data that must never appear in any topic or data field.
  const forbidden = [TITLE, "XYZ Hackathon 2026", "XYZ Community", userDid, "sertifikat-e2e.pdf"].map((s) =>
    stringToHex(s).slice(2).toLowerCase(),
  );

  for (const log of logs) {
    const decoded = decodeEventLog({ abi, data: log.data, topics: log.topics });
    const event = abi.find((e): e is AbiEvent => e.type === "event" && e.name === decoded.eventName)!;
    for (const input of event.inputs) expect(input.type, `${event.name}.${input.name}`).toMatch(allowed);
    const raw = [log.data, ...log.topics].join("").toLowerCase();
    for (const needle of forbidden) expect(raw.includes(needle)).toBe(false);
  }
});
