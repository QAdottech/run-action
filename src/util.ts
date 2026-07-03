import * as core from "@actions/core";

export const BASE_URL = "https://api.qa.tech";

export const POLLING_INTERVAL = 20_000;

export const BLOCKING_TIMEOUT_MS = 60 * 60_000;

/** Extra blocking waits after the first timeout while the review is still pending. */
export const BLOCKING_TIMEOUT_RETRIES = 2;

export const API_RETRY_ATTEMPTS = 3;
export const API_RETRY_DELAY_MS = 5_000;

const RETRYABLE_HTTP_STATUS = new Set([408, 429, 500, 502, 503, 504]);

const isRetryableError = (error: unknown): boolean => {
	if (!(error instanceof Error)) return false;

	const statusMatch = error.message.match(/HTTP error! status: (\d+)/);
	if (statusMatch) {
		return RETRYABLE_HTTP_STATUS.has(Number(statusMatch[1]));
	}

	const message = error.message.toLowerCase();
	return (
		error.name === "FetchError" ||
		message.includes("network") ||
		message.includes("timeout") ||
		message.includes("econnreset") ||
		message.includes("etimedout") ||
		message.includes("socket hang up")
	);
};

export const withRetry = async <T>(
	operation: () => Promise<T>,
	label: string,
	maxAttempts = API_RETRY_ATTEMPTS,
	delayMs = API_RETRY_DELAY_MS,
): Promise<T> => {
	let lastError: unknown;

	for (let attempt = 1; attempt <= maxAttempts; attempt++) {
		try {
			return await operation();
		} catch (error) {
			lastError = error;
			if (attempt === maxAttempts || !isRetryableError(error)) {
				throw error;
			}

			const message = error instanceof Error ? error.message : String(error);
			core.warning(
				`${label} failed (attempt ${attempt}/${maxAttempts}): ${message}. Retrying in ${
					delayMs / 1_000
				}s...`,
			);
			await sleep(delayMs);
		}
	}

	throw lastError;
};

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
