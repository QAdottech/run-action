import * as core from "@actions/core";
import * as github from "@actions/github";
import { type Payload, getRunStatus, triggerQATechRun } from "./api-client";

const BASE_URL = "https://app.qa.tech";
const POLLING_INTERVAL = 20000; // 20 seconds in milliseconds

const validateUrl = (url: string): boolean => {
	try {
		new URL(url);
		return true;
	} catch {
		return false;
	}
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const parseTestPlanShortIds = (input: string): string[] => {
	if (!input) return [];
	return input
		.split(",")
		.map((id) => id.trim())
		.filter(Boolean);
};

const getStartRunUrl = (baseUrl: string, projectId: string) =>
	`${baseUrl}/api/projects/${projectId}/runs`;

export async function run(): Promise<void> {
	try {
		core.debug("Starting the action");
		const overrideApiUrl = core.getInput("api_url");
		const baseApiUrl = overrideApiUrl.length === 0 ? BASE_URL : overrideApiUrl;
		const blocking = core.getBooleanInput("blocking");

		if (!validateUrl(baseApiUrl)) {
			core.setFailed(`Invalid API URL: ${baseApiUrl}`);
			return;
		}

		const projectId = core.getInput("project_id", { required: true });
		const apiToken = core.getInput("api_token", { required: true });
		const testPlanShortIds = parseTestPlanShortIds(
			core.getInput("test_plan_short_ids"),
		);

		if (!projectId) {
			core.setFailed('The "project_id" input is required');
			return;
		}

		if (!apiToken) {
			core.setFailed('The "api_token" input is required');
			return;
		}

		const apiUrl = getStartRunUrl(baseApiUrl, projectId);
		const { actor, ref, sha, repo } = github.context;

		const payload: Payload = {
			trigger: "GITHUB",
			actor,
			branch: ref,
			commitHash: sha,
			repository: repo.repo,
		};

		if (testPlanShortIds.length > 0) {
			core.debug(`Including test plans: ${testPlanShortIds.join(", ")}`);
			payload.testPlanShortIds = testPlanShortIds;
		}

		core.debug(
			`Triggering QA.tech run with payload: ${JSON.stringify(payload)}`,
		);

		const result = await triggerQATechRun(apiUrl, apiToken, payload);

		if (result.run) {
			core.setOutput("runId", result.run.id);
			core.setOutput("runShortId", result.run.shortId);
			core.info(
				`QA.tech run started with ID: ${result.run.id}, Short ID: ${result.run.shortId}`,
			);

			if (blocking) {
				core.info("Waiting for test results...");
				while (true) {
					const status = await getRunStatus(
						baseApiUrl,
						projectId,
						result.run.shortId,
						apiToken,
					);
					core.info(
						`Current status: ${status.status}, Result: ${
							status.result || "pending"
						}`,
					);

					if (status.status === "COMPLETED") {
						if (status.result === "FAILED") {
							core.setFailed("Test run failed");
							return;
						}
						if (status.result === "PASSED") {
							core.info("Test run completed successfully");
							return;
						}
						if (status.result === "SKIPPED") {
							core.warning("Test run was skipped");
							return;
						}
					}

					if (status.status === "ERROR") {
						core.setFailed("Test run encountered an error");
						return;
					}

					if (status.status === "CANCELLED") {
						core.setFailed("Test run was cancelled");
						return;
					}

					// If still running or initiated, wait and check again
					await sleep(POLLING_INTERVAL);
				}
			}
		} else {
			core.setFailed("No run details returned from API");
			return;
		}
	} catch (error) {
		if (error instanceof Error) {
			core.setFailed(`Action failed: ${error.message}`);
		} else {
			core.setFailed("An unexpected error occurred");
		}
	}
}

run();
