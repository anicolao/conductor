import { expect, test } from "@playwright/test";
import { TestStepHelper } from "../helpers/test-step-helper";

test.use({
	viewport: { width: 390, height: 844 },
	userAgent:
		"Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1",
	hasTouch: true,
});

test("Mobile Zoom Lens Magnifier in Documentation", async ({
	page,
}, testInfo) => {
	const helper = new TestStepHelper(page, testInfo);
	helper.setMetadata(
		"Mobile Zoom Lens Magnifier",
		"Verify that images in documentation pages are enhanced with the zoom lens magnifier and support touch interactions.",
	);

	const docPath = "tests/e2e/009-zoom-lens/README.md";

	// Mock GitHub Raw Content for README
	await page.route(
		/raw\.githubusercontent\.com.*README\.md/,
		async (route) => {
			await route.fulfill({
				status: 200,
				contentType: "text/plain",
				body: `# Mobile Zoom Test\n\n![Mobile Pin](./screenshots/000-mobile-tap-to-pin.png)`,
			});
		},
	);

	// Navigate directly to the docs route
	await page.goto(`/docs/${docPath}`);

	// Wait for content to load
	await expect(page.locator(".markdown-body")).toBeVisible({
		timeout: 15000,
	});

	const magnifier = page.locator(".magnifier-container");
	const canvas = magnifier.locator("canvas");

	await helper.step("mobile_tap_to_pin", {
		description: "Tapping pins the magnifier on mobile",
		verifications: [
			{
				spec: "Magnifier container exists",
				check: async () => {
					await expect(magnifier).toBeVisible();
				},
			},
			{
				spec: "Canvas exists and is loaded",
				check: async () => {
					await expect(canvas).toBeVisible();
					// Wait for canvas to have a non-zero size which means image is loaded
					await expect(async () => {
						const box = await canvas.boundingBox();
						expect(box?.width).toBeGreaterThan(0);
						expect(box?.height).toBeGreaterThan(0);
					}).toPass();
				},
			},
			{
				spec: "Pin indicator is initially hidden",
				check: async () => {
					await expect(page.locator(".pin-indicator")).not.toBeVisible();
				},
			},
			{
				spec: "Tapping shows pin indicator",
				check: async () => {
					await magnifier.tap();
					await expect(page.locator(".pin-indicator")).toBeVisible();
					await expect(page.locator(".pin-indicator")).toHaveText("PINNED");
				},
			},
		],
	});

	await helper.step("mobile_tap_to_unpin_and_dismiss", {
		description: "Tapping again unpins and dismisses the magnifier on mobile",
		verifications: [
			{
				spec: "Tapping again hides pin indicator",
				check: async () => {
					await magnifier.tap();
					await expect(page.locator(".pin-indicator")).not.toBeVisible();
				},
			},
		],
	});

	helper.generateDocs();
});
