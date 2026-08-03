import { describe, it, expect, vi } from "vitest";
import { runWithRetry } from "../src/retry";

describe("runWithRetry", () => {
  it("returns the result on first success without retrying", async () => {
    const fn = vi.fn().mockResolvedValue("ok");
    const result = await runWithRetry(fn, { retries: 3, baseDelayMs: 10, sleep: async () => {} });
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries on failure and succeeds on a later attempt", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("fail 1"))
      .mockRejectedValueOnce(new Error("fail 2"))
      .mockResolvedValueOnce("ok");
    const sleep = vi.fn().mockResolvedValue(undefined);

    const result = await runWithRetry(fn, { retries: 3, baseDelayMs: 100, sleep });

    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(3);
    // exponential backoff: 100ms, 200ms
    expect(sleep).toHaveBeenNthCalledWith(1, 100);
    expect(sleep).toHaveBeenNthCalledWith(2, 200);
  });

  it("throws the last error after exhausting all retries", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("always fails"));
    const sleep = vi.fn().mockResolvedValue(undefined);

    await expect(runWithRetry(fn, { retries: 2, baseDelayMs: 10, sleep })).rejects.toThrow(
      "always fails"
    );
    expect(fn).toHaveBeenCalledTimes(3); // initial attempt + 2 retries
  });

  it("calls onRetry with the attempt number and error", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("first failure"))
      .mockResolvedValueOnce("ok");
    const onRetry = vi.fn();

    await runWithRetry(fn, { retries: 2, baseDelayMs: 10, onRetry, sleep: async () => {} });

    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onRetry).toHaveBeenCalledWith(1, expect.any(Error));
  });
});
