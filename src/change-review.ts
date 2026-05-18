import * as core from "@actions/core";
import * as github from "@actions/github";
import {
	type ChangeReviewApplicationOverride,
	type ChangeReviewEnvironmentOverride,
	type ChangeReviewPayload,
	getChatConversation,
	startChangeReview,
} from "./api-client";
import {
	BASE_URL,
	POLLING_INTERVAL,
	handleUnexpectedError,
	sleep,
	validateUrl,
} from "./util";

const POLL_MESSAGE_LIMIT = 5;

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null && !Array.isArray(value);

const isEnvironmentOverride = (
	value: unknown,
): value is ChangeReviewEnvironmentOverride => {
	if (!isRecord(value)) return false;
	if (typeof value.url === "string" && value.url.length > 0) return true;
	if (typeof value.shortId === "string" && value.shortId.length > 0) return true;
	if (
		typeof value.applicationBuildShortId === "string" &&
		value.applicationBuildShortId.length > 0
	)
		return true;
	return false;
};

const parseApplicationOverrides = (
	input: string,
): ChangeReviewApplicationOverride[] => {
	let parsed: unknown;
	try {
		parsed = JSON.parse(input);
	} catch (error) {
		throw new Error(
			`Invalid JSON format for applications config input: ${
				error instanceof Error ? error.message : "Unknown error"
			}`,
		);
	}

	if (!isRecord(parsed)) {
		throw new Error(
			'Applications config input must be a JSON object with an "applications" property',
		);
	}

	const applicationsMap = parsed.applications;
	if (!isRecord(applicationsMap)) {
		throw new Error(
			'Applications config input must contain an "applications" property at the root level',
		);
	}

	const entries = Object.entries(applicationsMap);
	if (entries.length === 0) {
		throw new Error(
			"Applications config must include at least one application override",
		);
	}

	return entries.map(([applicationShortId, rawConfig]) => {
		if (!isRecord(rawConfig)) {
			throw new Error(
				`Application "${applicationShortId}" must be an object with an "environment" property`,
			);
		}

		const environment = rawConfig.environment;
		if (!isEnvironmentOverride(environment)) {
			throw new Error(
				`Application "${applicationShortId}" must include an "environment" with one of: url, shortId, or applicationBuildShortId`,
			);
		}

		const override: ChangeReviewApplicationOverride = {
			applicationShortId,
			environment,
		};

		if (typeof rawConfig.devicePresetShortId === "string") {
			override.devicePresetShortId = rawConfig.devicePresetShortId;
		}

		return override;
	});
};

const resolvePrUrl = (input: string): string | undefined => {
	const trimmed = input.trim();
	if (trimmed.length > 0) return trimmed;

	const { payload } = github.context;
	const pullRequest = isRecord(payload) ? payload.pull_request : undefined;
	if (!isRecord(pullRequest)) return undefined;

	const htmlUrl = pullRequest.html_url;
	return typeof htmlUrl === "string" && htmlUrl.length > 0
		? htmlUrl
		: undefined;
};

export async function run(): Promise<void> {
	try {
		core.debug("Starting the change-review action");

		const overrideApiUrl = core.getInput("api_url");
		const baseApiUrl = overrideApiUrl.length === 0 ? BASE_URL : overrideApiUrl;
		if (!validateUrl(baseApiUrl)) {
			core.setFailed(`Invalid API URL: ${baseApiUrl}`);
			return;
		}

		const apiToken = core.getInput("api_token", { required: true });
		if (!apiToken) {
			core.setFailed('The "api_token" input is required');
			return;
		}

		const blocking = core.getBooleanInput("blocking");

		const applicationsInput = core.getInput("applications_config");
		if (!applicationsInput || applicationsInput.trim().length === 0) {
			core.setFailed('The "applications_config" input is required');
			return;
		}

		let applicationOverrides: ChangeReviewApplicationOverride[];
		try {
			applicationOverrides = parseApplicationOverrides(applicationsInput);
		} catch (error) {
			core.setFailed(error instanceof Error ? error.message : String(error));
			return;
		}

		const contextInput = core.getInput("context");
		const context = contextInput.length > 0 ? contextInput : undefined;

		const prUrl = resolvePrUrl(core.getInput("pr_url"));
		if (!prUrl) {
			core.setFailed(
				'A pull request URL is required. Provide the "pr_url" input or run the action on a pull_request event.',
			);
			return;
		}

		const payload: ChangeReviewPayload = {
			mode: "pr",
			prUrl,
			vcsProviderId: "github",
			applicationOverrides,
			...(context ? { context } : {}),
		};

		core.debug(
			`Starting change review with payload: ${JSON.stringify(payload)}`,
		);

		const conversation = await startChangeReview(baseApiUrl, apiToken, payload);

		core.setOutput("chat_created", "true");
		core.setOutput("chat_short_id", conversation.shortId);
		core.setOutput("chat_url", conversation.url);
		core.info(
			`QA.tech change review started with chat ID: ${conversation.shortId}`,
		);
		core.info(`View chat at: ${conversation.url}`);

		if (!blocking) return;

		core.info(
			`Waiting for change review to complete... (${conversation.url})`,
		);

		while (true) {
			const latest = await getChatConversation(
				baseApiUrl,
				conversation.shortId,
				apiToken,
				POLL_MESSAGE_LIMIT,
			);

			const assistantMessage = latest.messages?.find(
				(message) => message.role === "assistant",
			);
			const status = assistantMessage?.status;

			core.info(`Current assistant message status: ${status ?? "pending"}`);

			if (status === "COMPLETED") {
				core.setOutput("chat_status", status);
				core.setOutput("chat_response", assistantMessage?.text ?? "");
				core.info(
					`Change review completed. View details at: ${conversation.url}`,
				);
				return;
			}

			if (status === "FAILED" || status === "CANCELLED") {
				core.setOutput("chat_status", status);
				core.setOutput("chat_response", assistantMessage?.text ?? "");
				core.setFailed(
					`Change review ${status.toLowerCase()}. View details at: ${
						conversation.url
					}`,
				);
				return;
			}

			await sleep(POLLING_INTERVAL);
		}
	} catch (error) {
		handleUnexpectedError(error);
	}
}

run();
