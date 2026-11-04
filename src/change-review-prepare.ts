import * as core from "@actions/core";
import * as github from "@actions/github";

import { prepareChangeReview } from "./api-client";
import {
	BASE_URL,
	getOptionalBooleanInput,
	handleUnexpectedError,
	validateUrl,
} from "./util";

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null && !Array.isArray(value);

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

const resolveCommitHash = (input: string): string | undefined => {
	const trimmed = input.trim();
	if (trimmed.length > 0) return trimmed;

	const { payload } = github.context;
	const pullRequest = isRecord(payload) ? payload.pull_request : undefined;
	if (!isRecord(pullRequest)) return undefined;

	const headSha = pullRequest.head;
	if (!isRecord(headSha)) return undefined;

	const sha = headSha.sha;
	return typeof sha === "string" && sha.length > 0 ? sha : undefined;
};

export async function run(): Promise<void> {
	try {
		core.debug("Starting the change-review-prepare action");

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

		const projectShortId = core.getInput("project_short_id", {
			required: true,
		});
		if (!projectShortId) {
			core.setFailed('The "project_short_id" input is required');
			return;
		}

		const prUrl = resolvePrUrl(core.getInput("pr_url"));
		if (!prUrl) {
			core.setFailed(
				'A pull request URL is required. Provide the "pr_url" input or run the action on a pull_request event.',
			);
			return;
		}

		const contextInput = core.getInput("context");
		const context = contextInput.length > 0 ? contextInput : undefined;

		const commitHash = resolveCommitHash(core.getInput("commit_hash"));
		const disableReviewComments = getOptionalBooleanInput(
			"disable_review_comments",
		);
		const { actor, ref, repo } = github.context;

		const payload = {
			projectShortId,
			prUrl,
			actor,
			branch: ref,
			repository: `${repo.owner}/${repo.repo}`,
			...(context ? { context } : {}),
			...(commitHash ? { commitHash } : {}),
			...(disableReviewComments !== undefined ? { disableReviewComments } : {}),
		};

		core.debug(
			`Preparing change review with payload: ${JSON.stringify(payload)}`,
		);

		const conversation = await prepareChangeReview(
			baseApiUrl,
			apiToken,
			payload,
		);

		core.setOutput("chat_created", "true");
		core.setOutput("chat_short_id", conversation.shortId);
		core.setOutput("chat_url", conversation.url);
		core.info(
			`QA.tech change review prepared with chat ID: ${conversation.shortId}`,
		);
		core.info(`View chat at: ${conversation.url}`);
	} catch (error) {
		handleUnexpectedError(error);
	}
}

run();
