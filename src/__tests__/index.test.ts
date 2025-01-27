// src/__tests__/index.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import * as core from "@actions/core";
import type * as github from "@actions/github";
import { triggerQATechRun } from "../api-client";
import { run } from "../index";

vi.mock("@actions/core");
vi.mock("../api-client");
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
	} as typeof github.context,
}));

describe("GitHub Action", () => {
	beforeEach(() => {
		vi.clearAllMocks();

		// Default core.getInput mock implementation
		vi.mocked(core.getInput).mockImplementation((name) => {
			switch (name) {
				case "project_id":
					return "test-project";
				case "api_token":
					return "test-token";
				case "api_url":
					return "";
				default:
					return "";
			}
		});
	});

	it("should successfully start a run and set run outputs", async () => {
		const mockRunResponse = {
			run: {
				id: "test-id",
				shortId: "short-id",
			},
		};

		vi.mocked(triggerQATechRun).mockResolvedValueOnce(mockRunResponse);

		await run();

		expect(triggerQATechRun).toHaveBeenCalledWith(
			"https://app.qa.tech/api/projects/test-project/runs",
			"test-token",
			{
				trigger: "GITHUB",
				actor: "testUser",
				branch: "refs/heads/main",
				commitHash: "abc123",
				repository: "test-repo",
			},
		);
		expect(core.setOutput).toHaveBeenCalledWith("runId", "test-id");
		expect(core.setOutput).toHaveBeenCalledWith("runShortId", "short-id");
		expect(core.setFailed).not.toHaveBeenCalled();
	});

	it("should successfully start a run and set success output", async () => {
		const mockRunResponse = {
			success: true,
		};

		vi.mocked(triggerQATechRun).mockResolvedValueOnce(mockRunResponse);

		await run();

		expect(core.setOutput).toHaveBeenCalledWith("success", true);
		expect(core.info).toHaveBeenCalledWith("QA.tech run success: true");
		expect(core.setFailed).not.toHaveBeenCalled();
	});

	it("should fail when API URL is invalid", async () => {
		vi.mocked(core.getInput).mockImplementation((name) => {
			switch (name) {
				case "api_url":
					return "invalid-url";
				default:
					return "test-value";
			}
		});

		await run();

		expect(core.setFailed).toHaveBeenCalledWith("Invalid API URL: invalid-url");
		expect(triggerQATechRun).not.toHaveBeenCalled();
	});

	it("should fail when project_id is missing", async () => {
		vi.mocked(core.getInput).mockImplementation((name) => {
			switch (name) {
				case "project_id":
					return "";
				case "api_token":
					return "test-token";
				default:
					return "";
			}
		});

		await run();

		expect(core.setFailed).toHaveBeenCalledWith(
			'The "project_id" input is required',
		);
		expect(triggerQATechRun).not.toHaveBeenCalled();
	});

	it("should fail when api_token is missing", async () => {
		vi.mocked(core.getInput).mockImplementation((name) => {
			switch (name) {
				case "project_id":
					return "test-project";
				case "api_token":
					return "";
				default:
					return "";
			}
		});

		await run();

		expect(core.setFailed).toHaveBeenCalledWith(
			'The "api_token" input is required',
		);
		expect(triggerQATechRun).not.toHaveBeenCalled();
	});

	it("should handle API errors", async () => {
		const error = new Error("API Error");
		vi.mocked(triggerQATechRun).mockRejectedValueOnce(error);

		await run();

		expect(core.setFailed).toHaveBeenCalledWith("Action failed: API Error");
	});

	it("should handle unknown errors", async () => {
		vi.mocked(triggerQATechRun).mockRejectedValueOnce("unknown error");

		await run();

		expect(core.setFailed).toHaveBeenCalledWith("An unexpected error occurred");
	});

	it("should use custom API URL when provided", async () => {
		const customApiUrl = "https://custom.qa.tech";
		vi.mocked(core.getInput).mockImplementation((name) => {
			switch (name) {
				case "api_url":
					return customApiUrl;
				case "project_id":
					return "test-project";
				case "api_token":
					return "test-token";
				default:
					return "";
			}
		});

		const mockRunResponse = {
			run: {
				id: "test-id",
				shortId: "short-id",
			},
		};
		vi.mocked(triggerQATechRun).mockResolvedValueOnce(mockRunResponse);

		await run();

		expect(triggerQATechRun).toHaveBeenCalledWith(
			`${customApiUrl}/api/projects/test-project/runs`,
			"test-token",
			expect.any(Object),
		);
	});
});
