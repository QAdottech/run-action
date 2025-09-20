import * as core from "@actions/core";
import * as github from "@actions/github";
import fetch from "node-fetch";

export interface RunDetails {
	id: string;
	shortId: string;
	url: string;
	testCount: number;
	testPlan: {
		name: string;
		short_id: string;
	} | null;
}

export interface Payload {
	trigger: string;
	actor: string;
	branch: string;
	commitHash: string;
	repository: `${string}/${string}`;
	testPlanShortId?: string;
	applications?: Record<
		string,
		{
			environment: {
				url: string;
				name?: string;
			};
		}
	>;
	integrationName?: string;
	exploratory?: boolean;
	exploratoryPrompt?: string;
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

export interface NotificationConfig {
	type: "github-comment" | "email" | "webhook";
	send_on: ("STARTED" | "COMPLETED" | "FAILED")[];
	silent_on?: ("PASSED" | "FAILED" | "SKIPPED")[];
	// GitHub comment specific
	pr_number?: number;
	// Email specific
	recipient?: string;
	// Webhook specific
	url?: string;
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

export const postGitHubPRComment = async (
	githubToken: string,
	prNumber: number,
	comment: string,
): Promise<void> => {
	try {
		const octokit = github.getOctokit(githubToken);
		const { owner, repo } = github.context.repo;

		await octokit.rest.issues.createComment({
			owner,
			repo,
			issue_number: prNumber,
			body: comment,
		});

		core.info(`Posted comment on PR #${prNumber}`);
	} catch (error) {
		if (error instanceof Error) {
			core.error(`Error posting GitHub PR comment: ${error.message}`);
		} else {
			core.error("An unknown error occurred posting GitHub PR comment");
		}
		throw error;
	}
};

export const processNotifications = async (
	notifications: NotificationConfig[],
	status: RunStatus,
	runUrl: string,
	exploratoryPrompt?: string,
): Promise<void> => {
	for (const notification of notifications) {
		// Check if we should send this notification based on status
		const shouldSend = notification.send_on.includes(status.status as any);
		const shouldSilent = notification.silent_on?.includes(status.result as any);

		if (!shouldSend || shouldSilent) {
			continue;
		}

		try {
			switch (notification.type) {
				case "github-comment":
					if (notification.pr_number) {
						const githubToken = process.env.GITHUB_TOKEN;
						if (!githubToken) {
							core.warning("GitHub token not available for posting PR comment");
							continue;
						}

						const comment = `## 🔍 Exploratory Testing Results

**Status:** ${status.result}
**Prompt:** ${exploratoryPrompt || "N/A"}

**Results:** [View detailed results](${runUrl})

${
	status.result === "FAILED"
		? "❌ Tests failed - please review the results"
		: status.result === "PASSED"
		? "✅ Tests passed successfully"
		: "⚠️ Tests were skipped"
}`;

						await postGitHubPRComment(
							githubToken,
							notification.pr_number,
							comment,
						);
					}
					break;
				case "email":
					// TODO: Implement email notifications
					core.info(
						`Email notification would be sent to: ${notification.recipient}`,
					);
					break;
				case "webhook":
					// TODO: Implement webhook notifications
					core.info(
						`Webhook notification would be sent to: ${notification.url}`,
					);
					break;
			}
		} catch (error) {
			core.warning(
				`Failed to process ${notification.type} notification: ${
					error instanceof Error ? error.message : "Unknown error"
				}`,
			);
		}
	}
};
