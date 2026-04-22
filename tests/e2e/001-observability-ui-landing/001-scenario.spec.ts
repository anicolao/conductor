import { expect, test } from "@playwright/test";
import { TestStepHelper } from "../helpers/test-step-helper";

test("Observability UI Landing Page", async ({ page }, testInfo) => {
	const helper = new TestStepHelper(page, testInfo);
	helper.setMetadata(
		"Observability UI Landing Page",
		"Verify the basic foundation of the Conductor Observability UI.",
	);

	await page.goto("/");

	await helper.step("landing_page_loaded", {
		description: "User navigates to the landing page",
		verifications: [
			{
				spec: 'Page title contains "Conductor"',
				check: async () => {
					await expect(page).toHaveTitle(/Conductor/);
				},
			},
			{
				spec: '"Conductor Observability" heading is visible',
				check: async () => {
					await expect(
						page.getByRole("heading", { name: "Conductor Observability" }),
					).toBeVisible();
				},
			},
			{
				spec: "Version indicator is visible in the footer",
				check: async () => {
					const footer = page.locator("footer.version-info");
					await expect(footer).toBeVisible();
					await expect(footer).toHaveText("v0.0.1 (test-commit) 2026-04-17");
				},
			},
		],
	});

	helper.generateDocs();
});
