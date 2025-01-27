// src/__tests__/index.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import * as core from "@actions/core";
import * as github from "@actions/github";
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
					return "test-token-12345";
				case "api_url":
					return "";
				case "test_plan_ids":
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
			"test-token-12345",
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

	it("should successfully start a run with test plans", async () => {
		const testPlans = "plan1,plan2, plan3";
		vi.mocked(core.getInput).mockImplementation((name) => {
			switch (name) {
				case "test_plan_ids":
					return testPlans;
				case "project_id":
					return "test-project";
				case "api_token":
					return "test-token-12345";
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
			"https://app.qa.tech/api/projects/test-project/runs",
			"test-token-12345",
			expect.objectContaining({
				testPlanShortIds: ["plan1", "plan2", "plan3"],
			}),
		);
	});

	it("should fail when API URL is invalid", async () => {
		vi.mocked(core.getInput).mockImplementation((name) => {
			switch (name) {
				case "api_url":
					return "invalid-url";
				case "project_id":
					return "test-project";
				case "api_token":
					return "test-token-12345";
				default:
					return "";
			}
		});

		await run();

		expect(core.setFailed).toHaveBeenCalledWith("Invalid API URL: invalid-url");
		expect(triggerQATechRun).not.toHaveBeenCalled();
	});

	it("should handle empty test plan IDs", async () => {
		const mockRunResponse = {
			run: {
				id: "test-id",
				shortId: "short-id",
			},
		};

		vi.mocked(triggerQATechRun).mockResolvedValueOnce(mockRunResponse);

		await run();

		expect(triggerQATechRun).toHaveBeenCalledWith(
			expect.any(String),
			expect.any(String),
			expect.not.objectContaining({
				testPlanShortIds: expect.anything(),
			}),
		);
	});

	it("should handle malformed test plan IDs", async () => {
		vi.mocked(core.getInput).mockImplementation((name) => {
			switch (name) {
				case "test_plan_ids":
					return ",,test1,,test2,,";
				case "project_id":
					return "test-project";
				case "api_token":
					return "test-token-12345";
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
			expect.any(String),
			expect.any(String),
			expect.objectContaining({
				testPlanShortIds: ["test1", "test2"],
			}),
		);
	});

	it("should handle HTTP 400 error", async () => {
		const errorResponse = new Error("HTTP error! status: 400 - Bad Request");
		vi.mocked(triggerQATechRun).mockRejectedValueOnce(errorResponse);

		await run();

		expect(core.setFailed).toHaveBeenCalledWith(
			"Action failed: HTTP error! status: 400 - Bad Request",
		);
	});

	it("should fail when project_id is missing", async () => {
		vi.mocked(core.getInput).mockImplementation((name, options) => {
			if (name === "project_id" && options?.required) {
				throw new Error("Input required and not supplied: project_id");
			}
			return name === "api_token" ? "test-token" : "";
		});

		await run();

		expect(core.setFailed).toHaveBeenCalledWith(
			"Action failed: Input required and not supplied: project_id",
		);
		expect(triggerQATechRun).not.toHaveBeenCalled();
	});

	it("should fail when api_token is missing", async () => {
		vi.mocked(core.getInput).mockImplementation((name, options) => {
			if (name === "api_token" && options?.required) {
				throw new Error("Input required and not supplied: api_token");
			}
			return name === "project_id" ? "test-project" : "";
		});

		await run();

		expect(core.setFailed).toHaveBeenCalledWith(
			"Action failed: Input required and not supplied: api_token",
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
					return "test-token-12345";
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
			"test-token-12345",
			expect.any(Object),
		);
	});
});
