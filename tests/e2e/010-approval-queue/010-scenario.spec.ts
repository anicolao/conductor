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
												optionId: "0fd775be",
											},
											content: {
												number: issueNumber,
												title: "Test Issue",
												updatedAt: new Date().toISOString(),
												bodyText: "Test body snippet for the approval queue.",
												author: {
													login: "test-user",
													avatarUrl: "https://github.com/test-user.png",
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
		} else if (requestBody.query.includes("GetDetails")) {
			await route.fulfill({
				status: 200,
				contentType: "application/json",
				body: JSON.stringify({
					data: {
						organization: {
							projectV2: {
								id: "project_id",
								fields: {
									nodes: [
										{ id: "status_field_id", name: "Status" },
										{ id: "persona_field_id", name: "Persona" },
									],
								},
							},
						},
						repository: {
							mergeCommitAllowed: true,
							squashMergeAllowed: true,
							rebaseMergeAllowed: true,
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
		} else if (
			requestBody.query.includes("UpdateField") ||
			requestBody.query.includes("ClearField")
		) {
			await route.fulfill({
				status: 200,
				contentType: "application/json",
				body: JSON.stringify({
					data: {
						updateProjectV2ItemFieldValue: {
							projectV2Item: { id: "item_1" },
						},
					},
				}),
			});
		} else if (requestBody.query.includes("FallbackProjectItem")) {
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
											content: {
												number: issueNumber,
												repository: {
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
						filename: "tests/e2e/010-approval-queue/README.md",
						raw_url: `https://raw.githubusercontent.com/${owner}/${repo}/raw/test-sha/tests%2Fe2e%2F010-approval-queue%2FREADME.md`,
						contents_url: `https://api.github.com/repos/${owner}/${repo}/contents/tests/e2e/010-approval-queue/README.md?ref=test-sha`,
					},
				]),
			});
		},
	);

	// Mock raw file content via API
	await page.route(
		`https://api.github.com/repos/${owner}/${repo}/contents/tests/e2e/010-approval-queue/README.md?ref=test-sha`,
		async (route) => {
			await route.fulfill({
				status: 200,
				contentType: "text/plain",
				body: `# Test Markdown Content
![Relative Image](./screenshots/img.png)
<img src="./screenshots/img2.png" alt="Raw HTML Image">
[Relative Link](./docs/other.md)`,
			});
		},
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
		},
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
		},
	);

	// Mock PR Merge API
	await page.route(
		`https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}/merge`,
		async (route) => {
			const postData = route.request().postDataJSON();
			// Since we mocked all merge methods as true, it should prefer squash
			if (postData.merge_method !== "squash") {
				await route.fulfill({
					status: 400,
					contentType: "application/json",
					body: JSON.stringify({
						message: `Expected merge_method squash, got ${postData.merge_method}`,
					}),
				});
				return;
			}
			await route.fulfill({
				status: 200,
				contentType: "application/json",
				body: JSON.stringify({ merged: true }),
			});
		},
	);

	// Mock image requests to return a dummy image
	await page.route("**/*.png", async (route) => {
		const dummyImage = Buffer.from(
			"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
			"base64",
		);
		await route.fulfill({
			status: 200,
			contentType: "image/png",
			body: dummyImage,
		});
	});

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
					expect(
						page.getByRole("link", { name: "Approval Queue" }),
					).toBeVisible(),
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
					expect(
						page.locator(".desktop-view").getByText(`#${issueNumber}`),
					).toBeVisible(),
			},
			{
				spec: "View & Approve link is visible",
				check: async () =>
					expect(
						page
							.locator(".desktop-view")
							.getByRole("link", { name: "View & Approve" }),
					).toBeVisible(),
			},
			{
				spec: "View & Approve link has itemId query param",
				check: async () => {
					const link = page
						.locator(".desktop-view")
						.getByRole("link", { name: "View & Approve" });
					await expect(link).toHaveAttribute("href", /itemId=item_1/);
				},
			},
		],
	});

	// Navigate to Detail Page
	await page.locator(".desktop-view").getByText("View & Approve").click();

	await helper.step("approval_detail_loaded", {
		description: "Approval detail page shows markdown artifacts and actions",
		verifications: [
			{
				spec: "Issue title is visible",
				check: async () =>
					expect(
						page.getByRole("heading", { name: "Test Issue" }),
					).toBeVisible(),
			},
			{
				spec: "Markdown artifact is listed",
				check: async () =>
					expect(
						page.getByText("tests/e2e/010-approval-queue/README.md"),
					).toBeVisible(),
			},
			{
				spec: "Actions buttons are visible",
				check: async () => {
					await expect(
						page.getByRole("button", { name: "Approve & Merge" }),
					).toBeVisible();
					await expect(
						page.getByRole("button", { name: "Comment & Move to In Progress" }),
					).toBeVisible();
					await expect(
						page.getByRole("button", { name: "Back to TODO" }),
					).toBeVisible();
				},
			},
		],
	});

	// Expand markdown
	await page.click('text="tests/e2e/010-approval-queue/README.md"');
	await helper.step("markdown_expanded", {
		description:
			"Markdown artifact can be expanded to view content and relative URLs are resolved",
		verifications: [
			{
				spec: "Rendered markdown content is visible",
				check: async () =>
					expect(
						page.getByRole("heading", { name: "Test Markdown Content" }),
					).toBeVisible(),
			},
			{
				spec: "Relative image URL is resolved",
				check: async () => {
					const img = page.locator('img[alt="Relative Image"]');
					await expect(img).toHaveAttribute(
						"src",
						`https://raw.githubusercontent.com/${owner}/${repo}/raw/test-sha/tests/e2e/010-approval-queue/screenshots/img.png`,
					);
				},
			},
			{
				spec: "Relative raw HTML image URL is resolved",
				check: async () => {
					const img = page.locator('img[alt="Raw HTML Image"]');
					await expect(img).toHaveAttribute(
						"src",
						`https://raw.githubusercontent.com/${owner}/${repo}/raw/test-sha/tests/e2e/010-approval-queue/screenshots/img2.png`,
					);
				},
			},
			{
				spec: "Relative link URL is resolved",
				check: async () => {
					const link = page.getByRole("link", { name: "Relative Link" });
					await expect(link).toHaveAttribute(
						"href",
						`https://raw.githubusercontent.com/${owner}/${repo}/raw/test-sha/tests/e2e/010-approval-queue/docs/other.md`,
					);
				},
			},
		],
	});

	// Mock window.confirm and alert
	page.on("dialog", async (dialog) => {
		if (dialog.type() === "confirm") {
			await dialog.accept();
		} else if (dialog.type() === "alert") {
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
				check: async () => expect(page.url()).toContain("/approval"),
			},
		],
	});

	helper.generateDocs();
});

test("Approval Queue Fallback Item ID", async ({ page }, testInfo) => {
	const helper = new TestStepHelper(page, testInfo);
	helper.setMetadata(
		"Approval Queue Fallback",
		"Verify the fallback search for project item ID if missing from URL and issue.",
	);

	const issueNumber = 193;
	const owner = "LLM-Orchestration";
	const repo = "conductor";

	// Mock GitHub GraphQL API
	await page.route("https://api.github.com/graphql", async (route) => {
		const requestBody = route.request().postDataJSON();

		if (requestBody.query.includes("GetDetails")) {
			await route.fulfill({
				status: 200,
				contentType: "application/json",
				body: JSON.stringify({
					data: {
						organization: {
							projectV2: {
								id: "project_id",
								fields: {
									nodes: [
										{ id: "status_field_id", name: "Status" },
										{ id: "persona_field_id", name: "Persona" },
									],
								},
							},
						},
						repository: {
							mergeCommitAllowed: true,
							squashMergeAllowed: true,
							rebaseMergeAllowed: true,
							issue: {
								id: "issue_node_id",
								title: "Test Issue Fallback",
								body: "Test Body",
								labels: { nodes: [] },
								projectItems: { nodes: [] }, // EMPTY!
								timelineItems: { nodes: [] },
							},
						},
					},
				}),
			});
		} else if (requestBody.query.includes("FallbackProjectItem")) {
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
											id: "fallback_item_id",
											content: {
												number: issueNumber,
												repository: {
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
		} else if (requestBody.query.includes("UpdateField")) {
			await route.fulfill({
				status: 200,
				contentType: "application/json",
				body: JSON.stringify({
					data: {
						updateProjectV2ItemFieldValue: {
							projectV2Item: { id: "fallback_item_id" },
						},
					},
				}),
			});
		} else {
			await route.fulfill({
				status: 200,
				contentType: "application/json",
				body: JSON.stringify({ data: {} }),
			});
		}
	});

	// Mock PR files API (return empty)
	await page.route(
		`https://api.github.com/repos/${owner}/${repo}/pulls/**`,
		async (route) => {
			await route.fulfill({
				status: 200,
				contentType: "application/json",
				body: JSON.stringify([]),
			});
		},
	);

	// Set token and navigate to detail page WITHOUT itemId in URL
	await page.goto("/");
	await page.evaluate(() => {
		localStorage.setItem("github_access_token", "test_access_token");
	});

	await page.goto(`/approval/${owner}/${repo}/${issueNumber}`);

	await helper.step("fallback_detail_loaded", {
		description: "Approval detail page loaded and fallback item ID found",
		verifications: [
			{
				spec: "Issue title is visible",
				check: async () =>
					expect(
						page.getByRole("heading", { name: "Test Issue Fallback" }),
					).toBeVisible(),
			},
		],
	});

	// Mock window.confirm
	page.on("dialog", async (dialog) => {
		if (dialog.type() === "confirm") {
			await dialog.accept();
		} else if (dialog.type() === "alert") {
			await dialog.accept();
		}
	});

	// Test Back to Todo Action (doesn't require comment)
	await page.click('button:has-text("Back to TODO")');
	await page.waitForURL(/\/approval\/?$/);

	await helper.step("fallback_action_successful", {
		description: "Action using fallback item ID successful",
		verifications: [
			{
				spec: "Redirected back to /approval",
				check: async () => expect(page.url()).toContain("/approval"),
			},
		],
	});

	helper.generateDocs();
});
