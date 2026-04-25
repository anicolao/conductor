import { expect, test } from "@playwright/test";
import { TestStepHelper } from "../helpers/test-step-helper";

test("Zoom Lens Magnifier in Gemini Events", async ({ page }, testInfo) => {
	const helper = new TestStepHelper(page, testInfo);
	helper.setMetadata(
		"Zoom Lens Magnifier",
		"Verify that images in Gemini messages are enhanced with the zoom lens magnifier.",
	);

	const runId = "9876543";
	const jobId = 3210;

	// Mock GitHub User API
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

	// Mock GitHub Repo API
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

	// Mock GitHub Run Details API
	await page.route(
		`https://api.github.com/repos/LLM-Orchestration/conductor/actions/runs/${runId}`,
		async (route) => {
			await route.fulfill({
				status: 200,
				contentType: "application/json",
				body: JSON.stringify({
					id: parseInt(runId, 10),
					display_title: "Zoom Lens Test Run",
					status: "completed",
					conclusion: "success",
					html_url: `https://github.com/LLM-Orchestration/conductor/actions/runs/${runId}`,
				}),
			});
		},
	);

	// Mock GitHub Jobs API
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

	// Mock GitHub Logs API
	await page.route(
		`https://api.github.com/repos/LLM-Orchestration/conductor/actions/jobs/${jobId}/logs`,
		async (route) => {
			const event1 = {
				v: 1,
				ts: "2026-04-18T10:00:00Z",
				event: "GEMINI_EVENT",
				data: {
					type: "message",
					role: "assistant",
					content:
						"Here is a screenshot:\n\n![Test Image](https://raw.githubusercontent.com/LLM-Orchestration/conductor/main/observability-ui/static/favicon.svg)",
				},
			};
			const logs = `2026-04-18T10:00:00Z ::CONDUCTOR_EVENT:: ${JSON.stringify(event1)}`;
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
					await expect(page.locator(".magnifier-container canvas")).toBeVisible();
				},
			},
			{
				spec: "No plain img tag remains",
				check: async () => {
					await expect(page.locator(".event-body.markdown img")).toHaveCount(0);
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
});
