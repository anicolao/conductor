import { expect, test } from "@playwright/test";
import { TestStepHelper } from "../helpers/test-step-helper";

test.use({ viewport: { width: 375, height: 667 } });

test("Approval Queue Mobile View", async ({ page }, testInfo) => {
	const helper = new TestStepHelper(page, testInfo);
	helper.setMetadata(
		"Approval Queue Mobile View",
		"Verify the approval queue mobile-specific layout and responsiveness.",
	);

	const issueNumber = 192;
	const owner = "LLM-Orchestration";
	const repo = "conductor";

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

	// Mock GitHub GraphQL API
	await page.route("https://api.github.com/graphql", async (route) => {
		const requestBody = route.request().postDataJSON();

		if (requestBody.query.includes("ProjectItems")) {
			await route.fulfill({
				status: 200,
				contentType: "application/json",
				body: JSON.stringify({
					data: {
						organization: {
							projectV2: {
								items: {
									nodes: [
										{
											id: "item_1",
											status: {
												name: "Human Review",
												optionId: "0fd775be",
											},
											content: {
												number: issueNumber,
												title: "Test Mobile Issue",
												updatedAt: new Date(
													Date.now() - 2 * 60 * 60 * 1000,
												).toISOString(), // 2h ago
												bodyText:
													"This is a test issue body snippet for mobile view verification.",
												author: {
													login: "test-author",
													avatarUrl: "https://github.com/test-author.png",
												},
												repository: {
													nameWithOwner: `${owner}/${repo}`,
													owner: { login: owner },
													name: repo,
												},
											},
										},
									],
								},
							},
						},
					},
				}),
			});
		} else if (requestBody.query.includes("IssueDetails")) {
			await route.fulfill({
				status: 200,
				contentType: "application/json",
				body: JSON.stringify({
					data: {
						repository: {
							mergeCommitAllowed: true,
							squashMergeAllowed: true,
							rebaseMergeAllowed: true,
							issue: {
								id: "issue_node_id",
								title: "Test Mobile Issue",
								body: "Test Body",
								labels: { nodes: [{ name: "persona: coder" }] },
								projectItems: { nodes: [{ id: "item_1" }] },
								timelineItems: {
									nodes: [],
								},
							},
						},
					},
				}),
			});
		} else {
			await route.continue();
		}
	});

	// Set token and navigate to approval queue
	await page.goto("/approval");
	await page.evaluate(() => {
		localStorage.setItem("github_access_token", "test_access_token");
	});
	await page.reload();

	await helper.step("mobile_view_active", {
		description:
			"Approval queue shows mobile list layout and hides desktop table",
		verifications: [
			{
				spec: "Mobile view container is visible",
				check: async () => expect(page.locator(".mobile-view")).toBeVisible(),
			},
			{
				spec: "Desktop view container is hidden",
				check: async () => expect(page.locator(".desktop-view")).toBeHidden(),
			},
			{
				spec: "List item is visible",
				check: async () => expect(page.locator(".list-item")).toBeVisible(),
			},
			{
				spec: "Avatar is visible",
				check: async () => expect(page.locator(".author-avatar")).toBeVisible(),
			},
			{
				spec: "Repo name is visible in header",
				check: async () =>
					expect(page.locator(".repo-name")).toContainText(`${owner}/${repo}`),
			},
			{
				spec: "Relative time is visible",
				check: async () =>
					expect(page.locator(".time-stamp")).toContainText("2h ago"),
			},
			{
				spec: "Subject (Title) is visible and bold",
				check: async () => {
					const subject = page.locator(".item-subject");
					await expect(subject).toContainText("Test Mobile Issue");
					await expect(subject).toHaveCSS("font-weight", "700");
				},
			},
			{
				spec: "Snippet is visible",
				check: async () =>
					expect(page.locator(".item-snippet")).toContainText(
						"This is a test issue body snippet",
					),
			},
			{
				spec: "Issue number is visible in footer",
				check: async () =>
					expect(page.locator(".issue-number")).toContainText(
						`#${issueNumber}`,
					),
			},
		],
	});

	// Navigate to Detail Page via mobile item link
	await page.click(".mobile-item-link");

	await helper.step("mobile_detail_view", {
		description: "Approval detail page adjusts for mobile screen",
		verifications: [
			{
				spec: "Detail page heading is visible",
				check: async () =>
					expect(page.locator("h1")).toContainText("Test Mobile Issue"),
			},
			{
				spec: "Button group stacks vertically",
				check: async () => {
					const group = page.locator(".button-group");
					await expect(group).toHaveCSS("flex-direction", "column");
				},
			},
			{
				spec: "Action buttons are full-width",
				check: async () => {
					const btn = page.locator(".btn.todo");
					const box = await btn.boundingBox();
					const containerBox = await page.locator(".container").boundingBox();
					if (box && containerBox) {
						// On mobile, it should take up most of the container width
						expect(box.width).toBeGreaterThan(containerBox.width * 0.8);
					}
				},
			},
		],
	});

	// New step: Verify WorkflowTable on landing page
	await page.goto("/");

	// Mock repo API
	await page.route(
		"https://api.github.com/repos/LLM-Orchestration/conductor",
		async (route) => {
			await route.fulfill({
				status: 200,
				contentType: "application/json",
				body: JSON.stringify({
					name: repo,
					full_name: `${owner}/${repo}`,
				}),
			});
		},
	);

	// Mock workflow runs API
	await page.route(
		"https://api.github.com/repos/LLM-Orchestration/conductor/actions/workflows/conductor.yml/runs?per_page=50",
		async (route) => {
			await route.fulfill({
				status: 200,
				contentType: "application/json",
				body: JSON.stringify({
					workflow_runs: [
						{
							id: 12345,
							display_title: `Conductor [${owner}/${repo}] Issue #${issueNumber}`,
							status: "completed",
							created_at: "2026-04-29T12:00:00Z",
							head_branch: "test-branch",
						},
					],
				}),
			});
		},
	);
	await page.reload();

	await helper.step("workflow_table_mobile_view", {
		description: "Workflow table displays as a list on mobile",
		verifications: [
			{
				spec: "Workflow mobile view is visible",
				check: async () =>
					expect(
						page.locator(".workflow-container .mobile-view"),
					).toBeVisible(),
			},
			{
				spec: "Workflow desktop view is hidden",
				check: async () =>
					expect(
						page.locator(".workflow-container .desktop-view"),
					).toBeHidden(),
			},
			{
				spec: "Repo tag is visible",
				check: async () =>
					expect(
						page.locator(".workflow-container .repo-tag").first(),
					).toContainText(`${owner}/${repo}`),
			},
			{
				spec: "Status link is visible",
				check: async () =>
					expect(
						page.locator(".workflow-container .status-link").first(),
					).toContainText("complete"),
			},
			{
				spec: "No horizontal scrolling in workflow container",
				check: async () => {
					const container = page.locator(".workflow-container");
					const scrollWidth = await container.evaluate((el) => el.scrollWidth);
					const clientWidth = await container.evaluate((el) => el.clientWidth);
					expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
				},
			},
		],
	});

	helper.generateDocs();
});
