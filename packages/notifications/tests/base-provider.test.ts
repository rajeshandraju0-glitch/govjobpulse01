import { describe, it, expect, vi } from "vitest";
import { BaseNotificationProvider } from "../src/base-provider";
import type { NotificationJobPayload } from "@govjobpulse/types";

const SAMPLE_JOB: NotificationJobPayload = {
  jobId: "job_1",
  slug: "technician-b",
  title: "Recruitment to the post of Technician 'B'",
  organizationName: "ISRO",
  applicationEnd: new Date("2026-07-20"),
  url: "https://www.govjobpulse.com/jobs/technician-b",
};

class FakeProvider extends BaseNotificationProvider {
  slug = "fake";
  name = "Fake";
  private enabled: boolean;
  doSendJobMock = vi.fn().mockResolvedValue(undefined);
  doHealthCheckMock = vi.fn().mockResolvedValue("ok");

  constructor(enabled: boolean) {
    super();
    this.enabled = enabled;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  protected async doSendJob(job: NotificationJobPayload): Promise<void> {
    return this.doSendJobMock(job);
  }

  protected async doHealthCheck(): Promise<string> {
    return this.doHealthCheckMock();
  }
}

describe("BaseNotificationProvider", () => {
  it("skips sending entirely when disabled — SKIPPED_DISABLED, not SENT or FAILED", async () => {
    const provider = new FakeProvider(false);
    const result = await provider.sendJob(SAMPLE_JOB);
    expect(result.status).toBe("SKIPPED_DISABLED");
    expect(provider.doSendJobMock).not.toHaveBeenCalled();
  });

  it("calls the real send when enabled and reports SENT on success", async () => {
    const provider = new FakeProvider(true);
    const result = await provider.sendJob(SAMPLE_JOB);
    expect(result.status).toBe("SENT");
    expect(provider.doSendJobMock).toHaveBeenCalledWith(SAMPLE_JOB);
  });

  it("catches a thrown error from doSendJob and reports FAILED, not an unhandled rejection", async () => {
    const provider = new FakeProvider(true);
    provider.doSendJobMock.mockRejectedValueOnce(new Error("platform API down"));
    const result = await provider.sendJob(SAMPLE_JOB);
    expect(result.status).toBe("FAILED");
    expect(result.errorMessage).toBe("platform API down");
  });

  it("sendBulk isolates a single failure — other jobs in the batch still get sent", async () => {
    const provider = new FakeProvider(true);
    provider.doSendJobMock
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("rate limited"))
      .mockResolvedValueOnce(undefined);

    const jobs = [SAMPLE_JOB, { ...SAMPLE_JOB, jobId: "job_2" }, { ...SAMPLE_JOB, jobId: "job_3" }];
    const results = await provider.sendBulk(jobs);

    expect(results.map((r) => r.status)).toEqual(["SENT", "FAILED", "SENT"]);
  });

  it("healthCheck reports unhealthy with a clear reason when disabled, without calling doHealthCheck", async () => {
    const provider = new FakeProvider(false);
    const result = await provider.healthCheck();
    expect(result.healthy).toBe(false);
    expect(result.detail).toMatch(/disabled/i);
    expect(provider.doHealthCheckMock).not.toHaveBeenCalled();
  });

  it("healthCheck reports healthy when enabled and doHealthCheck succeeds", async () => {
    const provider = new FakeProvider(true);
    const result = await provider.healthCheck();
    expect(result.healthy).toBe(true);
    expect(result.detail).toBe("ok");
  });

  it("healthCheck reports unhealthy (not a throw) when doHealthCheck itself fails", async () => {
    const provider = new FakeProvider(true);
    provider.doHealthCheckMock.mockRejectedValueOnce(new Error("invalid token"));
    const result = await provider.healthCheck();
    expect(result.healthy).toBe(false);
    expect(result.detail).toBe("invalid token");
  });
});
