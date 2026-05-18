import * as core from "@actions/core";
import * as github from "@actions/github";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getChatConversation, startChangeReview } from "../api-client";
import { run } from "../change-review";

vi.mock("@actions/core");
vi.mock("../api-client", () => ({
	startChangeReview: vi.fn(),
	getChatConversation: vi.fn(),
}));
vi.mock("@actions/github", () => ({
	default: vi.fn(),
	context: {
		actor: "testUser",
		ref: "refs/heads/main",
		sha: "abc123",
		repo: {
			owner: "test-owner",
			repo: "test-repo",
		},
		payload: {},
	} as unknown as typeof github.context,
}));

const DEFAULT_APPLICATIONS_CONFIG = JSON.stringify({
	applications: {
		app_ONdgMD: {
			environment: {
				url: "https://app.bugduck.tech?release=test1233",
			},
		},
	},
});

const mockChatResponse = (
	overrides: Partial<{
		shortId: string;
		url: string;
		messages: Array<{
			id: string;
			role: "user" | "assistant";
			createdAt: string;
			text: string;
			status?: "INITIATED" | "PARTIAL" | "COMPLETED" | "CANCELLED" | "FAILED";
		}>;
	}> = {},
) => ({
	shortId: overrides.shortId ?? "chat_abc123",
	url: overrides.url ?? "https://app.qa.tech/dashboard/p/test/chat/chat_abc123",
	createdAt: "2025-01-01T00:00:00Z",
	updatedAt: "2025-01-01T00:00:00Z",
	messages: overrides.messages ?? [],
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

const setBlocking = (blocking: boolean) => {
	vi.mocked(core.getBooleanInput).mockImplementation((name) => {
		if (name === "blocking") return blocking;
		return false;
	});
};

describe("Change Review GitHub Action", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		(github.context as { payload: Record<string, unknown> }).payload = {};

		setInputs({
			api_token: "test-token-12345",
			applications_config: DEFAULT_APPLICATIONS_CONFIG,
		});
		setBlocking(false);
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("starts a change review using the pr_url input", async () => {
		setInputs({
			api_token: "test-token-12345",
			applications_config: DEFAULT_APPLICATIONS_CONFIG,
			pr_url: "https://github.com/test-owner/test-repo/pull/42",
		});

		vi.mocked(startChangeReview).mockResolvedValueOnce(mockChatResponse());

		await run();

		expect(startChangeReview).toHaveBeenCalledWith(
			"https://api.qa.tech",
			"test-token-12345",
			{
				mode: "pr",
				prUrl: "https://github.com/test-owner/test-repo/pull/42",
				vcsProviderId: "github",
				applicationOverrides: [
					{
						applicationShortId: "app_ONdgMD",
						environment: {
							url: "https://app.bugduck.tech?release=test1233",
						},
					},
				],
			},
		);
		expect(core.setOutput).toHaveBeenCalledWith("chat_created", "true");
		expect(core.setOutput).toHaveBeenCalledWith("chat_short_id", "chat_abc123");
		expect(core.setOutput).toHaveBeenCalledWith(
			"chat_url",
			"https://app.qa.tech/dashboard/p/test/chat/chat_abc123",
		);
		expect(core.setFailed).not.toHaveBeenCalled();
	});

	it("auto-derives the PR URL from the pull_request event payload", async () => {
		(github.context as { payload: Record<string, unknown> }).payload = {
			pull_request: {
				html_url: "https://github.com/test-owner/test-repo/pull/99",
			},
		};

		vi.mocked(startChangeReview).mockResolvedValueOnce(mockChatResponse());

		await run();

		expect(startChangeReview).toHaveBeenCalledWith(
			expect.any(String),
			expect.any(String),
			expect.objectContaining({
				mode: "pr",
				prUrl: "https://github.com/test-owner/test-repo/pull/99",
				vcsProviderId: "github",
			}),
		);
		expect(core.setFailed).not.toHaveBeenCalled();
	});

	it("forwards the optional context input", async () => {
		setInputs({
			api_token: "test-token-12345",
			applications_config: DEFAULT_APPLICATIONS_CONFIG,
			pr_url: "https://github.com/test-owner/test-repo/pull/42",
			context: "Focus on auth flow",
		});

		vi.mocked(startChangeReview).mockResolvedValueOnce(mockChatResponse());

		await run();

		expect(startChangeReview).toHaveBeenCalledWith(
			expect.any(String),
			expect.any(String),
			expect.objectContaining({ context: "Focus on auth flow" }),
		);
	});

	it("fails when applications_config is missing", async () => {
		setInputs({
			api_token: "test-token-12345",
		});

		await run();

		expect(core.setFailed).toHaveBeenCalledWith(
			'The "applications_config" input is required',
		);
		expect(startChangeReview).not.toHaveBeenCalled();
	});

	it("fails when an applications_config entry has no environment", async () => {
		setInputs({
			api_token: "test-token-12345",
			applications_config: JSON.stringify({
				applications: {
					app_ONdgMD: {},
				},
			}),
			pr_url: "https://github.com/test-owner/test-repo/pull/42",
		});

		await run();

		expect(core.setFailed).toHaveBeenCalledWith(
			expect.stringContaining('Application "app_ONdgMD"'),
		);
		expect(startChangeReview).not.toHaveBeenCalled();
	});

	it("fails when no PR URL can be resolved", async () => {
		setInputs({
			api_token: "test-token-12345",
			applications_config: DEFAULT_APPLICATIONS_CONFIG,
		});

		await run();

		expect(core.setFailed).toHaveBeenCalledWith(
			expect.stringContaining("pull request URL is required"),
		);
		expect(startChangeReview).not.toHaveBeenCalled();
	});

	it("polls the chat conversation in blocking mode until COMPLETED", async () => {
		vi.useFakeTimers();

		setInputs({
			api_token: "test-token-12345",
			applications_config: DEFAULT_APPLICATIONS_CONFIG,
			pr_url: "https://github.com/test-owner/test-repo/pull/42",
		});
		setBlocking(true);

		vi.mocked(startChangeReview).mockResolvedValueOnce(mockChatResponse());

		const pending = mockChatResponse({
			messages: [
				{
					id: "msg-1",
					role: "assistant",
					createdAt: "2025-01-01T00:00:01Z",
					text: "thinking...",
					status: "INITIATED",
				},
			],
		});
		const completed = mockChatResponse({
			messages: [
				{
					id: "msg-1",
					role: "assistant",
					createdAt: "2025-01-01T00:00:02Z",
					text: "All clear! No regressions detected.",
					status: "COMPLETED",
				},
			],
		});

		vi.mocked(getChatConversation)
			.mockResolvedValueOnce(pending)
			.mockResolvedValueOnce(completed);

		const runPromise = run();
		await vi.runAllTimersAsync();
		await runPromise;

		expect(getChatConversation).toHaveBeenCalledTimes(2);
		expect(core.setOutput).toHaveBeenCalledWith("chat_status", "COMPLETED");
		expect(core.setOutput).toHaveBeenCalledWith(
			"chat_response",
			"All clear! No regressions detected.",
		);
		expect(core.setFailed).not.toHaveBeenCalled();
	});

	it("fails the action when the assistant message ends in FAILED", async () => {
		vi.useFakeTimers();

		setInputs({
			api_token: "test-token-12345",
			applications_config: DEFAULT_APPLICATIONS_CONFIG,
			pr_url: "https://github.com/test-owner/test-repo/pull/42",
		});
		setBlocking(true);

		vi.mocked(startChangeReview).mockResolvedValueOnce(mockChatResponse());

		const failed = mockChatResponse({
			messages: [
				{
					id: "msg-1",
					role: "assistant",
					createdAt: "2025-01-01T00:00:02Z",
					text: "Something went wrong",
					status: "FAILED",
				},
			],
		});

		vi.mocked(getChatConversation).mockResolvedValueOnce(failed);

		const runPromise = run();
		await vi.runAllTimersAsync();
		await runPromise;

		expect(core.setOutput).toHaveBeenCalledWith("chat_status", "FAILED");
		expect(core.setOutput).toHaveBeenCalledWith(
			"chat_response",
			"Something went wrong",
		);
		expect(core.setFailed).toHaveBeenCalledWith(
			expect.stringContaining("Change review failed"),
		);
	});

	it("fails when the API URL is invalid", async () => {
		setInputs({
			api_token: "test-token-12345",
			api_url: "invalid-url",
			applications_config: DEFAULT_APPLICATIONS_CONFIG,
			pr_url: "https://github.com/test-owner/test-repo/pull/42",
		});

		await run();

		expect(core.setFailed).toHaveBeenCalledWith("Invalid API URL: invalid-url");
		expect(startChangeReview).not.toHaveBeenCalled();
	});

	it("surfaces API errors via core.setFailed", async () => {
		setInputs({
			api_token: "test-token-12345",
			applications_config: DEFAULT_APPLICATIONS_CONFIG,
			pr_url: "https://github.com/test-owner/test-repo/pull/42",
		});

		vi.mocked(startChangeReview).mockRejectedValueOnce(
			new Error("HTTP error! status: 400 - Bad Request"),
		);

		await run();

		expect(core.setFailed).toHaveBeenCalledWith(
			"Action failed: HTTP error! status: 400 - Bad Request",
		);
	});
});
