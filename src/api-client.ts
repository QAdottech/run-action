import * as core from "@actions/core";
import fetch from "node-fetch";

export interface RunDetails {
	id: string;
	shortId: string;
	url: string;
}

export interface Payload {
	trigger: string;
	actor: string;
	branch: string;
	commitHash: string;
	repository: string;
	testPlanShortId?: string;
}

export interface ApiResponse {
	success?: boolean;
	run?: RunDetails;
}

export interface RunStatus {
	id: string;
	short_id: string;
	status: "INITIATED" | "RUNNING" | "COMPLETED" | "ERROR" | "CANCELLED";
	result: "PASSED" | "FAILED" | "SKIPPED" | null;
}

export const triggerQATechRun = async (
	apiUrl: string,
	apiToken: string,
	payload: Payload,
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
				`HTTP error! status: ${response.status} - ${await response.text()}`,
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
export const getRunStatus = async (
	baseUrl: string,
	projectId: string,
	shortId: string,
	apiToken: string,
): Promise<RunStatus> => {
	try {
		const response = await fetch(
			`${baseUrl}/api/projects/${projectId}/runs/${shortId}`,
			{
				headers: {
					Authorization: `Bearer ${apiToken}`,
				},
			},
		);

		if (!response.ok) {
			throw new Error(
				`HTTP error! status: ${response.status} - ${await response.text()}`,
			);
		}

		const data = (await response.json()) as RunStatus;
		return data;
	} catch (error) {
		if (error instanceof Error) {
			core.error(`Error getting run status: ${error.message}`);
		} else {
			core.error("An unknown error occurred getting run status");
		}
		throw error;
	}
};
