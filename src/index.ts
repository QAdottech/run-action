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
			core.setOutput("run_created", "true");
			core.setOutput("run_short_id", result.run.shortId);
			core.info(
				`QA.tech run started with ID: ${result.run.id}, Short ID: ${result.run.shortId}`,
			);
			core.info(`View run at: ${result.run.url}`);

			if (blocking) {
				core.info(`Waiting for test results... (${result.run.url})`);
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
						core.setOutput("run_status", status.status);
						core.setOutput("run_result", status.result);

						if (status.result === "FAILED") {
							core.setFailed(
								`Test run failed. View results at: ${result.run.url}`,
							);
							return;
						}
						if (status.result === "PASSED") {
							core.info(
								`Test run completed successfully. View results at: ${result.run.url}`,
							);
							return;
						}
						if (status.result === "SKIPPED") {
							core.warning(
								`Test run was skipped. View details at: ${result.run.url}`,
							);
							return;
						}
					}

					if (status.status === "ERROR" || status.status === "CANCELLED") {
						core.setOutput("run_status", status.status);
						core.setFailed(
							`Run ${status.status.toLowerCase()}. View details at: ${
								result.run.url
							}`,
						);
						return;
					}

					// If still running or initiated, wait and check again
					await sleep(POLLING_INTERVAL);
				}
			}
		} else {
			core.setOutput("run_created", "false");
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
