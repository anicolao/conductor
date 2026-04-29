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
			"Approval queue shows mobile card layout and hides desktop table",
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
				spec: "Approval card is visible",
				check: async () => expect(page.locator(".approval-card")).toBeVisible(),
			},
			{
				spec: "Issue number is visible in card",
				check: async () =>
					expect(page.locator(".issue-tag")).toContainText(`#${issueNumber}`),
			},
			{
				spec: "Repo name is visible in card",
				check: async () =>
					expect(page.locator(".repo-tag")).toContainText(`${owner}/${repo}`),
			},
			{
				spec: "Title is visible in card",
				check: async () =>
					expect(page.locator(".card-title")).toContainText(
						"Test Mobile Issue",
					),
			},
			{
				spec: "Mobile action hint is visible",
				check: async () => {
					const hint = page.locator(".action-hint");
					await expect(hint).toBeVisible();
					await expect(hint).toContainText("View & Approve");
				},
			},
		],
	});

	// Navigate to Detail Page via mobile card link
	await page.click(".mobile-card-link");

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

	helper.generateDocs();
});
