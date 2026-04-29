import { expect, test } from "@playwright/test";
import { TestStepHelper } from "../helpers/test-step-helper";

test("Markdown Support in Gemini Events", async ({ page }, testInfo) => {
	const helper = new TestStepHelper(page, testInfo);
	helper.setMetadata(
		"Markdown Support",
		"Verify that Gemini messages and results are rendered as markdown.",
	);

	const runId = "987654";
	const jobId = 321;

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
					display_title: "Markdown Test Run",
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
					role: "user",
					content:
						"# Hello\nThis is **bold** and *italic*.\n- Item 1\n- Item 2\n\n```javascript\nconsole.log('hello');\n```",
				},
			};
			const event2 = {
				v: 1,
				ts: "2026-04-18T10:00:05Z",
				event: "GEMINI_EVENT",
				data: {
					type: "result",
					status: "success",
					response: "### Success\nYour task is **complete**.\n1. One\n2. Two",
					stats: {
						tokens: { total: 10, prompt: 5, completion: 5 },
						latency: 100,
					},
				},
			};
			const logs = `
2026-04-18T10:00:00Z ::CONDUCTOR_EVENT:: ${JSON.stringify(event1)}
2026-04-18T10:00:05Z ::CONDUCTOR_EVENT:: ${JSON.stringify(event2)}
    `;
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

	// Wait for events to load
	await expect(page.locator(".gemini-event")).toHaveCount(2, {
		timeout: 15000,
	});

	await helper.step("markdown_rendered", {
		description: "Markdown content is correctly rendered in Gemini events",
		verifications: [
			{
				spec: "User message renders markdown",
				check: async () => {
					const userMessage = page.locator(".gemini-event.message.user");
					await expect(userMessage.locator("h1")).toHaveText("Hello");
					await expect(userMessage.locator("strong")).toHaveText("bold");
					await expect(userMessage.locator("em")).toHaveText("italic");
					await expect(userMessage.locator("ul li")).toHaveCount(2);
					await expect(userMessage.locator("pre code")).toContainText(
						"console.log('hello');",
					);
				},
			},
			{
				spec: "Gemini result renders markdown",
				check: async () => {
					const result = page.locator(".gemini-event.result");
					await expect(result.locator("h3")).toHaveText("Success");
					await expect(result.locator("strong")).toHaveText("complete");
					await expect(result.locator("ol li")).toHaveCount(2);
				},
			},
			{
				spec: "Raw JSON section is present",
				check: async () => {
					await expect(page.locator(".raw-json-section")).toHaveCount(2);
					await expect(page.getByText("Event JSON")).toHaveCount(2);
				},
			},
		],
	});
});
