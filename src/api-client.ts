import fetch from "node-fetch";
import * as core from "@actions/core";

export interface RunDetails {
  id: string;
  shortId: string;
}

export interface Payload {
  trigger: string;
  actor: string;
  branch: string;
  commitHash: string;
  repository: string;
  testPlanShortIds?: string[];
}

export interface ApiResponse {
  success?: boolean;
  run?: RunDetails;
}

export const triggerQATechRun = async (
  apiUrl: string,
  apiToken: string,
  payload: Payload
): Promise<ApiResponse> => {
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
};
