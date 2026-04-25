import { expect, test } from "@playwright/test";
import { TestStepHelper } from "../helpers/test-step-helper";

test("Zoom Lens Magnifier in Documentation", async ({ page }, testInfo) => {
	const helper = new TestStepHelper(page, testInfo);
	helper.setMetadata(
		"Zoom Lens Magnifier",
		"Verify that images in documentation pages are enhanced with the zoom lens magnifier.",
	);

	const docPath = "tests/e2e/009-zoom-lens/README.md";

	// Mock GitHub Raw Content for README
	await page.route(
		/raw\.githubusercontent\.com.*README\.md/,
		async (route) => {
			await route.fulfill({
				status: 200,
				contentType: "text/plain",
				body: `# Zoom Lens Test\n\n![Magnifier Rendered](./screenshots/000-magnifier-rendered.png)`,
			});
		},
	);

	// Navigate directly to the docs route
	await page.goto(`/docs/${docPath}`);

	// Wait for content to load
	await expect(page.locator(".markdown-body")).toBeVisible({
		timeout: 15000,
	});

	await helper.step("magnifier_rendered", {
		description: "Magnifier component is rendered instead of a plain img tag",
		verifications: [
			{
				spec: "Magnifier container exists",
				check: async () => {
					await expect(page.locator(".magnifier-container")).toBeVisible();
				},
			},
			{
				spec: "Canvas exists inside magnifier",
				check: async () => {
					await expect(
						page.locator(".magnifier-container canvas"),
					).toBeVisible();
				},
			},
			{
				spec: "No plain img tag remains",
				check: async () => {
					await expect(page.locator(".markdown-body img")).toHaveCount(0);
				},
			},
		],
	});

	await helper.step("pinning_functionality", {
		description: "Clicking pins the magnifier",
		verifications: [
			{
				spec: "Pin indicator is initially hidden",
				check: async () => {
					await expect(page.locator(".pin-indicator")).not.toBeVisible();
				},
			},
			{
				spec: "Clicking shows pin indicator",
				check: async () => {
					await page.click(".magnifier-container");
					await expect(page.locator(".pin-indicator")).toBeVisible();
					await expect(page.locator(".pin-indicator")).toHaveText("PINNED");
				},
			},
			{
				spec: "Clicking again hides pin indicator",
				check: async () => {
					await page.click(".magnifier-container");
					await expect(page.locator(".pin-indicator")).not.toBeVisible();
				},
			},
		],
	});

	helper.generateDocs();
});
