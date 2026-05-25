import * as core from "@actions/core";

export const BASE_URL = "https://api.qa.tech";

export const POLLING_INTERVAL = 20_000;

export const BLOCKING_TIMEOUT_MS = 60 * 60_000;

export const validateUrl = (url: string): boolean => {
	try {
		new URL(url);
		return true;
	} catch {
		return false;
	}
};

export const sleep = (ms: number): Promise<void> =>
	new Promise((resolve) => setTimeout(resolve, ms));

export const handleUnexpectedError = (error: unknown): void => {
	if (error instanceof Error) {
		core.setFailed(`Action failed: ${error.message}`);
	} else {
		core.setFailed("An unexpected error occurred");
	}
};
