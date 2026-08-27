import * as core from "@actions/core";
import fetch from "node-fetch";
import { withRetry } from "./util";

export interface RunDetails {
	id: string;
	shortId: string;
	url: string;
	testCount: number;
	testPlan: {
		name: string;
		shortId: string;
	} | null;
}

export interface Payload {
	trigger: string;
	projectShortId: string;
	actor: string;
	branch: string;
	commitHash: string;
	repository: `${string}/${string}`;
	testPlanShortId?: string;
	applications?: Array<{
		applicationShortId: string;
		environment?:
			| {
					url: string;
					name?: string;
			  }
			| {
					shortId: string;
			  };
		devicePresetShortId?: string;
	}>;
}

export interface ApiResponse {
	success?: boolean;
	run?: RunDetails;
}

export interface RunStatus {
	id: string;
	shortId: string;
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
	shortId: string,
	apiToken: string,
): Promise<RunStatus> => {
	try {
		const response = await fetch(`${baseUrl}/run/${shortId}`, {
			headers: {
				Authorization: `Bearer ${apiToken}`,
			},
		});

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

export type ChangeReviewEnvironmentOverride =
	| { url: string; name?: string }
	| { shortId: string }
	| { applicationBuildShortId: string };

export interface ChangeReviewApplicationOverride {
	applicationShortId: string;
	devicePresetShortId?: string;
	environment: ChangeReviewEnvironmentOverride;
}

export interface ChangeReviewPayload {
	mode: "pr";
	projectShortId: string;
	prUrl: string;
	vcsProviderId: "github";
	applicationOverrides: ChangeReviewApplicationOverride[];
	context?: string;
}

export type ChatMessageStatus =
	| "INITIATED"
	| "PARTIAL"
	| "COMPLETED"
	| "CANCELLED"
	| "FAILED";

export interface ChatMessageItem {
	id: string;
	role: "user" | "assistant";
	createdAt: string;
	text: string;
	status?: ChatMessageStatus;
	isStreaming?: boolean;
}

export interface ChatConversationResponse {
	shortId: string;
	url: string;
	title?: string;
	createdAt: string;
	updatedAt: string;
	source?: "api" | "ui" | "github" | "gitlab" | "system";
	messages?: ChatMessageItem[];
}

export const startChangeReview = async (
	baseUrl: string,
	apiToken: string,
	payload: ChangeReviewPayload,
): Promise<ChatConversationResponse> => {
	try {
		return await withRetry(async () => {
			const response = await fetch(`${baseUrl}/v1/chat/change-review`, {
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

			return (await response.json()) as ChatConversationResponse;
		}, "Start change review");
	} catch (error) {
		if (error instanceof Error) {
			core.error(`Error starting change review: ${error.message}`);
		} else {
			core.error("An unknown error occurred starting change review");
		}
		throw error;
	}
};

export const getChatConversation = async (
	baseUrl: string,
	shortId: string,
	apiToken: string,
	limit = 20,
): Promise<ChatConversationResponse> => {
	try {
		return await withRetry(async () => {
			const response = await fetch(
				`${baseUrl}/v1/chat/${shortId}?limit=${limit}`,
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

			return (await response.json()) as ChatConversationResponse;
		}, "Get chat conversation");
	} catch (error) {
		if (error instanceof Error) {
			core.error(`Error getting chat conversation: ${error.message}`);
		} else {
			core.error("An unknown error occurred getting chat conversation");
		}
		throw error;
	}
};
