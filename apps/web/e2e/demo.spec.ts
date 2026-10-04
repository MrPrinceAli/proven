import { expect, test } from "@playwright/test";

// D-032: a judge explores Proven without a wallet — sandbox user → demo issuer approves on-chain → back.
test("demo mode: sandbox user, demo issuer approval, verified credential", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Coba sebagai User" }).click();
  await page.waitForURL("**/dashboard");
  await expect(page.getByRole("note")).toContainText("Mode demo");

  await page.goto("/dashboard/profile");
  const claim = page.getByRole("listitem").filter({ hasText: "XYZ Hackathon 2026 — Winner" });
  await expect(claim.getByText("Menunggu issuer")).toBeVisible();

  await page.getByRole("button", { name: "Beralih ke Issuer demo" }).click();
  await page.waitForURL("**/issuer");
  await page
    .getByRole("button", { name: /XYZ Hackathon 2026 — Winner/ })
    .first()
    .click();
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Setujui & terbitkan" }).click();
  await expect(page.getByText(/Kredensial terbit/)).toBeVisible({ timeout: 30_000 });

  await page.getByRole("button", { name: "Beralih ke User demo" }).click();
  await page.waitForURL("**/dashboard");
  await page.goto("/dashboard/profile");
  await expect(claim.getByText("Terverifikasi")).toBeVisible();
});
