import * as core from "@actions/core";
import * as github from "@actions/github";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { prepareChangeReview } from "../api-client";
import { run } from "../change-review-prepare";

vi.mock("@actions/core");
vi.mock("../api-client", () => ({
	prepareChangeReview: vi.fn(),
}));
vi.mock("@actions/github", () => ({
	default: vi.fn(),
	context: {
		actor: "testUser",
		ref: "refs/heads/feature",
		sha: "abc123",
		repo: {
			owner: "test-owner",
			repo: "test-repo",
		},
		payload: {},
	} as unknown as typeof github.context,
}));

const mockChatResponse = (
	overrides: Partial<{ shortId: string; url: string }> = {},
) => ({
	shortId: overrides.shortId ?? "chat_abc123",
	url: overrides.url ?? "https://app.qa.tech/dashboard/p/test/chat/chat_abc123",
	createdAt: "2025-01-01T00:00:00Z",
	updatedAt: "2025-01-01T00:00:00Z",
	status: "in_progress" as const,
});

const setInputs = (inputs: Record<string, string>) => {
	vi.mocked(core.getInput).mockImplementation((name, options) => {
		const value = inputs[name];
		if (value === undefined) {
			if (options?.required) {
				throw new Error(`Input required and not supplied: ${name}`);
			}
			return "";
		}
		return value;
	});
};

describe("Change Review Prepare GitHub Action", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		(github.context as { payload: Record<string, unknown> }).payload = {};

		setInputs({
			project_short_id: "proj_12345",
			api_token: "test-token-12345",
		});
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("prepares a change review using the pr_url input", async () => {
		setInputs({
			project_short_id: "proj_12345",
			api_token: "test-token-12345",
			pr_url: "https://github.com/test-owner/test-repo/pull/42",
			commit_hash: "deadbeef",
		});

		vi.mocked(prepareChangeReview).mockResolvedValueOnce(mockChatResponse());

		await run();

		expect(prepareChangeReview).toHaveBeenCalledWith(
			"https://api.qa.tech",
			"test-token-12345",
			{
				projectShortId: "proj_12345",
				prUrl: "https://github.com/test-owner/test-repo/pull/42",
				commitHash: "deadbeef",
				actor: "testUser",
				branch: "refs/heads/feature",
				repository: "test-owner/test-repo",
			},
		);
		expect(core.setOutput).toHaveBeenCalledWith("chat_created", "true");
		expect(core.setOutput).toHaveBeenCalledWith("chat_short_id", "chat_abc123");
		expect(core.setFailed).not.toHaveBeenCalled();
	});

	it("auto-derives the PR URL and commit from the pull_request event payload", async () => {
		(github.context as { payload: Record<string, unknown> }).payload = {
			pull_request: {
				html_url: "https://github.com/test-owner/test-repo/pull/99",
				head: { sha: "cafebabe" },
			},
		};

		vi.mocked(prepareChangeReview).mockResolvedValueOnce(mockChatResponse());

		await run();

		expect(prepareChangeReview).toHaveBeenCalledWith(
			expect.any(String),
			expect.any(String),
			expect.objectContaining({
				prUrl: "https://github.com/test-owner/test-repo/pull/99",
				commitHash: "cafebabe",
			}),
		);
	});

	it("forwards the optional context input", async () => {
		setInputs({
			project_short_id: "proj_12345",
			api_token: "test-token-12345",
			pr_url: "https://github.com/test-owner/test-repo/pull/42",
			context: "Focus on auth flow",
		});

		vi.mocked(prepareChangeReview).mockResolvedValueOnce(mockChatResponse());

		await run();

		expect(prepareChangeReview).toHaveBeenCalledWith(
			expect.any(String),
			expect.any(String),
			expect.objectContaining({ context: "Focus on auth flow" }),
		);
	});

	it("forwards disable_review_comments as disableReviewComments", async () => {
		setInputs({
			project_short_id: "proj_12345",
			api_token: "test-token-12345",
			pr_url: "https://github.com/test-owner/test-repo/pull/42",
			disable_review_comments: "true",
		});

		vi.mocked(prepareChangeReview).mockResolvedValueOnce(mockChatResponse());

		await run();

		expect(prepareChangeReview).toHaveBeenCalledWith(
			expect.any(String),
			expect.any(String),
			expect.objectContaining({ disableReviewComments: true }),
		);
	});

	it("omits disableReviewComments when the input is not set", async () => {
		setInputs({
			project_short_id: "proj_12345",
			api_token: "test-token-12345",
			pr_url: "https://github.com/test-owner/test-repo/pull/42",
		});

		vi.mocked(prepareChangeReview).mockResolvedValueOnce(mockChatResponse());

		await run();

		expect(
			vi.mocked(prepareChangeReview).mock.calls[0]?.[2],
		).not.toHaveProperty("disableReviewComments");
	});

	it("fails on an invalid disable_review_comments value", async () => {
		setInputs({
			project_short_id: "proj_12345",
			api_token: "test-token-12345",
			pr_url: "https://github.com/test-owner/test-repo/pull/42",
			disable_review_comments: "yes",
		});

		await run();

		expect(prepareChangeReview).not.toHaveBeenCalled();
		expect(core.setFailed).toHaveBeenCalled();
	});

	it("fails when no PR URL can be resolved", async () => {
		await run();

		expect(core.setFailed).toHaveBeenCalledWith(
			expect.stringContaining("pull request URL is required"),
		);
		expect(prepareChangeReview).not.toHaveBeenCalled();
	});
});
