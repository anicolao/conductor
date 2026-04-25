import { expect, test } from "@playwright/test";
import { TestStepHelper } from "../helpers/test-step-helper";

test.use({
	viewport: { width: 390, height: 844 },
	userAgent:
		"Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1",
	hasTouch: true,
});

test("Mobile Zoom Lens Magnifier in Gemini Events", async ({
	page,
}, testInfo) => {
	const helper = new TestStepHelper(page, testInfo);
	helper.setMetadata(
		"Mobile Zoom Lens Magnifier",
		"Verify that images in Gemini messages are enhanced with the zoom lens magnifier and support touch interactions.",
	);

	const runId = "mobile-zoom-test-robust";
	const jobId = 4569;

	// Mock GitHub APIs
	await page.route("https://api.github.com/user", async (route) => {
		await route.fulfill({
			status: 200,
			contentType: "application/json",
			body: JSON.stringify({
				login: "test-user",
				avatar_url: "https://github.com/test-user.png",
			}),
		});
	});

	await page.route(
		"https://api.github.com/repos/LLM-Orchestration/conductor",
		async (route) => {
			await route.fulfill({
				status: 200,
				contentType: "application/json",
				body: JSON.stringify({ full_name: "LLM-Orchestration/conductor" }),
			});
		},
	);

	await page.route(
		`https://api.github.com/repos/LLM-Orchestration/conductor/actions/runs/${runId}`,
		async (route) => {
			await route.fulfill({
				status: 200,
				contentType: "application/json",
				body: JSON.stringify({
					id: 12347,
					display_title: "Mobile Zoom Test Run Robust",
					status: "completed",
					conclusion: "success",
					html_url: `https://github.com/LLM-Orchestration/conductor/actions/runs/${runId}`,
				}),
			});
		},
	);

	await page.route(
		`https://api.github.com/repos/LLM-Orchestration/conductor/actions/runs/${runId}/jobs`,
		async (route) => {
			await route.fulfill({
				status: 200,
				contentType: "application/json",
				body: JSON.stringify({
					jobs: [{ id: jobId, name: "run-conductor" }],
				}),
			});
		},
	);

	await page.route(
		`https://api.github.com/repos/LLM-Orchestration/conductor/actions/jobs/${jobId}/logs`,
		async (route) => {
			const event = {
				v: 1,
				ts: "2026-04-18T10:00:00Z",
				event: "GEMINI_EVENT",
				data: {
					type: "message",
					role: "assistant",
					content:
						"Mobile screenshot robust:\n\n![Mobile Image](https://raw.githubusercontent.com/LLM-Orchestration/conductor/main/observability-ui/static/favicon.svg)",
				},
			};
			const logs = `2026-04-18T10:00:00Z ::CONDUCTOR_EVENT:: ${JSON.stringify(event)}`;
			await route.fulfill({
				status: 200,
				contentType: "text/plain",
				body: logs,
			});
		},
	);

	// Set token and navigate
	await page.goto("/");
	await page.evaluate(() => {
		localStorage.setItem("github_access_token", "test_access_token");
	});

	await page.goto(`/run?id=${runId}`);

	// Wait for event to load
	await expect(page.locator(".gemini-event")).toHaveCount(1, {
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
});
