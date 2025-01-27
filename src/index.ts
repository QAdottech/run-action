import * as core from "@actions/core";
import * as github from "@actions/github";
import { triggerQATechRun, type Payload } from "./api-client";

const BASE_URL = "https://app.qa.tech";

const validateUrl = (url: string): boolean => {
	try {
		new URL(url);
		return true;
	} catch {
		return false;
	}
};

const parseTestPlanIds = (input: string): string[] => {
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

		if (!validateUrl(baseApiUrl)) {
			core.setFailed(`Invalid API URL: ${baseApiUrl}`);
			return;
		}

		const projectId = core.getInput("project_id", { required: true });
		const apiToken = core.getInput("api_token", { required: true });
		const testPlanIds = parseTestPlanIds(core.getInput("test_plan_ids"));

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

		if (testPlanIds.length > 0) {
			core.debug(`Including test plans: ${testPlanIds.join(", ")}`);
			payload.testPlanShortIds = testPlanIds;
		}

		core.debug(
			`Triggering QA.tech run with payload: ${JSON.stringify(payload)}`,
		);

		const result = await triggerQATechRun(apiUrl, apiToken, payload);

		if (result.success !== undefined) {
			core.setOutput("success", result.success);
			core.info(`QA.tech run success: ${result.success}`);
		} else if (result.run) {
			core.setOutput("runId", result.run.id);
			core.setOutput("runShortId", result.run.shortId);
			core.info(
				`QA.tech run started with ID: ${result.run.id}, Short ID: ${result.run.shortId}`,
			);
		}
	} catch (error) {
		if (error instanceof Error) {
			core.setFailed(`Action failed: ${error.message}`);
		} else {
			core.setFailed("An unexpected error occurred");
		}
	}
}

if (require.main === module) {
	run();
}
