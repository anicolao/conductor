import { expect, test } from "@playwright/test";
import { TestStepHelper } from "../helpers/test-step-helper";

test("Observability Log Parser Debug Page", async ({ page }, testInfo) => {
	const helper = new TestStepHelper(page, testInfo);
	helper.setMetadata(
		"Observability Log Parser Debug Page",
		"Verify that the log parser correctly extracts and displays events.",
	);

	await page.goto("/debug");

	await helper.step("debug_page_loaded", {
		description: "User navigates to the debug page",
		verifications: [
			{
				spec: "Heading is visible",
				check: async () => {
					await expect(
						page.getByRole("heading", { name: "Conductor Log Parser Debug" }),
					).toBeVisible();
				},
			},
			{
				spec: "Textarea is visible",
				check: async () => {
					await expect(
						page.getByPlaceholder("Paste your logs here"),
					).toBeVisible();
				},
			},
		],
	});

	const sampleLogs = `
Some random log line
::CONDUCTOR_EVENT::{"v":1,"ts":"2026-04-12T10:00:00.000Z","event":"session_start","persona":"coder","data":{"branch":"feat/parser","labels":[]}}
Another random log line
::CONDUCTOR_EVENT::{"v":1,"ts":"2026-04-12T10:05:00.000Z","event":"session_end","persona":"coder","data":{"status":"success"}}
  `.trim();

	await page.fill("textarea", sampleLogs);

	await helper.step("logs_parsed", {
		description: "User pastes sample logs",
		verifications: [
			{
				spec: "Two event cards are rendered",
				check: async () => {
					const cards = page.locator(".event-card");
					await expect(cards).toHaveCount(2);
				},
			},
			{
				spec: "session_start event is visible",
				check: async () => {
					await expect(page.getByText("Session Started")).toBeVisible();
					await expect(page.getByText("feat/parser")).toBeVisible();
				},
			},
			{
				spec: "session_end event is visible",
				check: async () => {
					await expect(page.getByText("Session Ended (success)")).toBeVisible();
					await expect(page.getByText("success")).toBeVisible();
				},
			},
		],
	});

	helper.generateDocs();
});
