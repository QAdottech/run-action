import * as core from "@actions/core";
import * as github from "@actions/github";
import fetch from "node-fetch";

interface RunDetails {
  id: string;
  shortId: string;
}

interface Payload {
  trigger: string;
  actor: string;
  branch: string;
  commitHash: string;
  repository: string;
}

interface ApiResponse {
  success?: boolean;
  run?: RunDetails;
}

const BASE_URL = "https://app.qa.tech";

const validateUrl = (url: string): boolean => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};
const getStartRunUrl = (baseUrl: string, projectId: string) =>
  `${baseUrl}/api/projects/${projectId}/runs`;

async function triggerQATechRun(
  apiUrl: string,
  apiToken: string,
  payload: Payload
): Promise<ApiResponse> {
  try {
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiToken}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(
        `HTTP error! status: ${response.status} - ${await response.text()}`
      );
    }

    const apiResponse = (await response.json()) as ApiResponse;
    return apiResponse;
  } catch (error) {
    if (error instanceof Error) {
      core.error(`Error during fetch operation: ${error.message}`);
    } else {
      core.error("An unknown error occurred during fetch");
    }
    throw error;
  }
}

async function run(): Promise<void> {
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

    if (!projectId) {
      core.setFailed('The "project_id" input is required');
    }

    if (!apiToken) {
      core.setFailed('The "api_token" input is required');
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

    core.debug(
      `Triggering QA.tech run with payload: ${JSON.stringify(payload)}`
    );

    const result = await triggerQATechRun(apiUrl, apiToken, payload);

    if (result.success !== undefined) {
      core.setOutput("success", result.success);
      core.info(`QA.tech run success: ${result.success}`);
    } else if (result.run) {
      core.setOutput("runId", result.run.id);
      core.setOutput("runShortId", result.run.shortId);
      core.info(
        `QA.tech run started with ID: ${result.run.id}, Short ID: ${result.run.shortId}`
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

run();
