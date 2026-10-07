import { expect, test, type Page } from "@playwright/test";

const PASSWORD = process.env.DEMO_PASSWORD ?? "e2e-pass";

async function login(page: Page) {
  await page.goto("/signals");
  await expect(page).toHaveURL(/\/login/);
  await page.fill('input[name="password"]', PASSWORD);
  await page.click("button:has-text('Enter')");
  await expect(page).toHaveURL(/\/signals/);
}

test("password gate blocks unauthenticated access and pages are noindex", async ({ page, request }) => {
  const res = await request.get("/scorecard", { maxRedirects: 0 });
  expect(res.status()).toBe(307);
  expect(res.headers()["location"]).toContain("/login");
  expect(res.headers()["x-robots-tag"]).toContain("noindex");
  await page.goto("/login");
  await page.fill('input[name="password"]', "wrong");
  await page.click("button:has-text('Enter')");
  await expect(page.getByText("That password did not match.")).toBeVisible();
});

test("9-step walkthrough renders end to end with no console errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(String(e)));
  await login(page);

  // 1. Signal feed: 14 in 72h, 4 material, filtered-out group with the Red Sea notice
  await expect(page.getByTestId("material-count")).toHaveText("4");
  await page.getByTestId("filtered-toggle").click();
  await expect(page.getByTestId("signal-row-SIG-0021")).toContainText("No exposure");

  // 2. Headline signal
  await page.getByTestId("signal-row-SIG-0007").locator("a").first().click();
  await expect(page).toHaveURL(/SIG-0007/);
  await expect(page.getByTestId("classification")).toContainText("0.91");

  // 3. Impact panel and chain
  const scores = page.getByTestId("impact-scores");
  for (const v of ["78", "64", "55", "70"]) await expect(scores).toContainText(v);
  await expect(page.getByTestId("impact-chain").locator("svg")).toBeVisible();

  // 4. Options with a recommendation; Ask panel streams
  await expect(page.locator('[data-testid^="option-OPT-"]')).toHaveCount(5);
  await expect(page.getByTestId("recommended-marker")).toHaveCount(1);
  for (const id of ["options", "last_time", "cheapest", "why_move"]) {
    await page.getByTestId(`ask-${id}`).click();
  }
  await expect(page.getByTestId("ask-answer").last()).toContainText("WO-2601", { timeout: 5000 });
  await page.getByLabel("Ask about this signal").fill("tell me a joke");
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("ask-answer").last()).toContainText("In production this is a live query", { timeout: 5000 });

  // compare
  await page.getByLabel("Compare Switch to approved second source with air expedite").check();
  await page.getByLabel("Compare PMA alternate with customer approval").check();
  await page.getByTestId("compare-open").click();
  await expect(page.getByTestId("compare-table")).toBeVisible();
  await page.keyboard.press("Escape");

  // 5. Approve; agent actions animate to confirmed with document numbers
  await page.getByTestId("choose-OPT-1").click();
  await page.getByTestId("approve-confirm").click();
  const panel = page.getByTestId("execution-panel");
  await expect(panel).toBeVisible();
  await expect(panel.locator('[data-status="confirmed"]')).toHaveCount(4, { timeout: 10_000 });
  await expect(panel).toContainText("45000");

  // 6. Risk scorecard as Rajiv
  await page.getByTestId("persona-switcher").click();
  await page.getByText("Rajiv Menon").click();
  await page.goto("/scorecard");
  await expect(page.locator('[data-testid^="sc-row-"]')).toHaveCount(15);
  await expect(page.getByTestId("sc-row-100118")).toHaveAttribute("data-band", "red");
  await expect(page.locator('[data-band="amber"]')).toHaveCount(2);
  await page.getByTestId("rec-approve-DIV-01").click();
  await expect(page.getByTestId("rec-DIV-01")).toContainText("Sourcing task ST-101");

  // 7. Precedents
  await page.goto("/signals/SIG-0007");
  await page.getByTestId("precedent-PRE-03").click();
  await expect(page.getByTestId("precedent")).toContainText("70/30");
  await page.keyboard.press("Escape");

  // Split PO builder recomputes and routes through approval
  await page.goto("/purchasing");
  const ratio = page.getByTestId("split-ratio");
  const before = await page.getByTestId("split-result").innerText();
  await page.getByTestId("split-slider").fill("50");
  await expect(ratio).toHaveText("50/50");
  expect(await page.getByTestId("split-result").innerText()).not.toEqual(before);
  await page.getByTestId("split-submit").click();
  await page.getByTestId("split-approve").click();
  await expect(page.getByTestId("execution-panel").locator('[data-status="confirmed"]')).toHaveCount(2, { timeout: 10_000 });

  // 8. Stubs
  for (const route of ["/shipment", "/warehouse", "/relationships"]) {
    await page.goto(route);
    await expect(page.getByText("Phase 2", { exact: true })).toBeVisible();
    await expect(page.getByTestId("recommended-marker")).toHaveCount(1);
  }

  // 9. Predict
  await page.goto("/predict");
  await expect(page.getByTestId("predict-card")).toContainText("Probability of impact");

  // Execution log has the SAP writes
  await page.goto("/log");
  await expect(page.getByTestId("log-table")).toContainText("Create split PO 70/30");

  // Inject a library signal opens its workspace
  await page.goto("/signals");
  await page.getByTestId("inject-open").click();
  await page.getByTestId("inject-LIB-01").click();
  await expect(page).toHaveURL(/LIB-01/);
  await expect(page.getByTestId("impact-scores")).toBeVisible();

  // Feedback persists across reload
  await page.getByTestId("flag-this").click();
  await page.getByTestId("feedback-wrong").fill("Triage owner is missing");
  await page.getByTestId("feedback-save").click();
  await page.goto("/feedback");
  await page.reload();
  await expect(page.getByTestId("feedback-table")).toContainText("Triage owner is missing");

  expect(errors).toEqual([]);
});
