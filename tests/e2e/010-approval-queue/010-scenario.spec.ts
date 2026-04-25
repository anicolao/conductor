import { expect, test } from "@playwright/test";
import { TestStepHelper } from "../helpers/test-step-helper";

test("Approval Queue Flow", async ({ page }, testInfo) => {
	const helper = new TestStepHelper(page, testInfo);
	helper.setMetadata(
		"Approval Queue Flow",
		"Verify the approval queue listing, detail view, and actions.",
	);

	const issueNumber = 192;
	const prNumber = 200;
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

	// Mock GitHub Repo API
	await page.route(
		`https://api.github.com/repos/${owner}/${repo}`,
		async (route) => {
			await route.fulfill({
				status: 200,
				contentType: "application/json",
				body: JSON.stringify({ full_name: `${owner}/${repo}` }),
			});
		},
	);

	// Mock GitHub GraphQL API for listing
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
												optionId: "0fd775be"
											},
											content: {
												number: issueNumber,
												title: "Test Issue",
												repository: {
													nameWithOwner: `${owner}/${repo}`,
													owner: { login: owner },
													name: repo
												}
											}
										}
									]
								}
							}
						}
					}
				}),
			});
		} else if (requestBody.query.includes("IssueDetails")) {
			await route.fulfill({
				status: 200,
				contentType: "application/json",
				body: JSON.stringify({
					data: {
						repository: {
							issue: {
								id: "issue_node_id",
								title: "Test Issue",
								body: "Test Body",
								labels: { nodes: [{ name: "persona: coder" }] },
								projectItems: { nodes: [{ id: "item_1" }] },
								timelineItems: {
									nodes: [
										{
											source: {
												number: prNumber,
												url: `https://github.com/${owner}/${repo}/pull/${prNumber}`,
												state: "OPEN",
												baseRepository: {
													owner: { login: owner },
													name: repo
												}
											}
										}
									]
								}
							}
						}
					}
				}),
			});
		} else if (requestBody.query.includes("UpdateField") || requestBody.query.includes("ClearField")) {
			await route.fulfill({
				status: 200,
				contentType: "application/json",
				body: JSON.stringify({
					data: {
						updateProjectV2ItemFieldValue: {
							projectV2Item: { id: "item_1" }
						}
					}
				}),
			});
		} else {
			await route.continue();
		}
	});

	// Mock PR files API
	await page.route(
		`https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}/files`,
		async (route) => {
			await route.fulfill({
				status: 200,
				contentType: "application/json",
				body: JSON.stringify([
					{
						filename: "TEST.md",
						raw_url: "https://raw.githubusercontent.com/test/TEST.md",
						contents_url: `https://api.github.com/repos/${owner}/${repo}/contents/TEST.md?ref=test-sha`
					}
				]),
			});
		}
	);

	// Mock raw file content via API
	await page.route(
		`https://api.github.com/repos/${owner}/${repo}/contents/TEST.md?ref=test-sha`,
		async (route) => {
			await route.fulfill({
				status: 200,
				contentType: "text/plain",
				body: "# Test Markdown Content",
			});
		}
	);

	// Mock Issue Comment API
	await page.route(
		`https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}/comments`,
		async (route) => {
			await route.fulfill({
				status: 201,
				contentType: "application/json",
				body: JSON.stringify({ id: 123 }),
			});
		}
	);

	// Mock Issue Labels API
	await page.route(
		`https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}/labels`,
		async (route) => {
			await route.fulfill({
				status: 200,
				contentType: "application/json",
				body: JSON.stringify([{ name: "persona: conductor" }]),
			});
		}
	);

	// Mock PR Merge API
	await page.route(
		`https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}/merge`,
		async (route) => {
			await route.fulfill({
				status: 200,
				contentType: "application/json",
				body: JSON.stringify({ merged: true }),
			});
		}
	);

	// Set token and navigate to home
	await page.goto("/");
	await page.evaluate(() => {
		localStorage.setItem("github_access_token", "test_access_token");
	});

	// Check Approval Queue button on home page
	await helper.step("home_page_loaded", {
		description: "Approval Queue button is visible on dashboard",
		verifications: [
			{
				spec: "Approval Queue button is visible",
				check: async () =>
					expect(page.getByRole("link", { name: "Approval Queue" })).toBeVisible(),
			},
		],
	});

	// Navigate to Approval Queue
	await page.click('text="Approval Queue"');
	
	await helper.step("approval_queue_list_loaded", {
		description: "Approval queue list shows items in Human Review",
		verifications: [
			{
				spec: "Issue #192 is listed",
				check: async () =>
					expect(page.getByText(`#${issueNumber}`)).toBeVisible(),
			},
			{
				spec: "View & Approve link is visible",
				check: async () =>
					expect(page.getByRole("link", { name: "View & Approve" })).toBeVisible(),
			},
		],
	});

	// Navigate to Detail Page
	await page.click('text="View & Approve"');

	await helper.step("approval_detail_loaded", {
		description: "Approval detail page shows markdown artifacts and actions",
		verifications: [
			{
				spec: "Issue title is visible",
				check: async () =>
					expect(page.getByRole("heading", { name: "Test Issue" })).toBeVisible(),
			},
			{
				spec: "Markdown artifact is listed",
				check: async () =>
					expect(page.getByText("TEST.md")).toBeVisible(),
			},
			{
				spec: "Actions buttons are visible",
				check: async () => {
					await expect(page.getByRole("button", { name: "Approve & Merge" })).toBeVisible();
					await expect(page.getByRole("button", { name: "Comment & Move to In Progress" })).toBeVisible();
					await expect(page.getByRole("button", { name: "Back to TODO" })).toBeVisible();
				},
			},
		],
	});

	// Expand markdown
	await page.click('text="TEST.md"');
	await helper.step("markdown_expanded", {
		description: "Markdown artifact can be expanded to view content",
		verifications: [
			{
				spec: "Rendered markdown content is visible",
				check: async () =>
					expect(page.getByRole("heading", { name: "Test Markdown Content" })).toBeVisible(),
			},
		],
	});

	// Mock window.confirm and alert
	page.on('dialog', async dialog => {
		if (dialog.type() === 'confirm') {
			await dialog.accept();
		} else if (dialog.type() === 'alert') {
			await dialog.accept();
		}
	});

	// Test Approve Action
	await page.click('button:has-text("Approve & Merge")');
	await page.waitForURL(/\/approval\/?$/);

	await helper.step("approved_successfully", {
		description: "Approve action redirects back to queue",
		verifications: [
			{
				spec: "Redirected back to /approval",
				check: async () =>
					expect(page.url()).toContain("/approval"),
			},
		],
	});

	helper.generateDocs();
});
