import * as core from "@actions/core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { withRetry } from "../util";

vi.mock("@actions/core");

describe("withRetry", () => {
	afterEach(() => {
		vi.useRealTimers();
	});

	it("retries retryable HTTP errors before succeeding", async () => {
		vi.useFakeTimers();

		const operation = vi
			.fn()
			.mockRejectedValueOnce(new Error("HTTP error! status: 503 - unavailable"))
			.mockResolvedValueOnce("ok");

		const promise = withRetry(operation, "Test operation", 3, 1_000);
		await vi.runAllTimersAsync();
		const result = await promise;

		expect(result).toBe("ok");
		expect(operation).toHaveBeenCalledTimes(2);
		expect(core.warning).toHaveBeenCalledWith(
			expect.stringContaining("Test operation failed (attempt 1/3)"),
		);
	});

	it("does not retry non-retryable HTTP errors", async () => {
		const operation = vi
			.fn()
			.mockRejectedValue(new Error("HTTP error! status: 400 - Bad Request"));

		await expect(withRetry(operation, "Test operation", 3, 1)).rejects.toThrow(
			"HTTP error! status: 400 - Bad Request",
		);
		expect(operation).toHaveBeenCalledTimes(1);
	});
});
