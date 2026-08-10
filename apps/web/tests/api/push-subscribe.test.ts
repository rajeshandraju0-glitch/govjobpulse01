import { describe, it, expect, vi, beforeEach } from "vitest";

const mockUpsert = vi.fn();
const mockUpdateMany = vi.fn();

vi.mock("@govjobpulse/database", () => ({
  prisma: {
    pushSubscription: {
      upsert: (...args: unknown[]) => mockUpsert(...args),
      updateMany: (...args: unknown[]) => mockUpdateMany(...args),
    },
  },
}));

vi.mock("@/lib/rate-limit", () => ({
  rateLimitRequest: vi.fn().mockResolvedValue({ allowed: true, remaining: 9, limit: 10 }),
}));

import { POST, DELETE } from "../../app/api/push/subscribe/route";

function makeRequest(method: string, body?: unknown, url = "http://localhost/api/push/subscribe"): Request {
  return new Request(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

describe("POST /api/push/subscribe", () => {
  beforeEach(() => mockUpsert.mockReset());

  it("rejects a missing endpoint with 400", async () => {
    const res = await POST(makeRequest("POST", { platform: "WEB" }));
    expect(res.status).toBe(400);
  });

  it("rejects an invalid platform with 400", async () => {
    const res = await POST(makeRequest("POST", { endpoint: "https://push.example.com/abc", platform: "BLACKBERRY" }));
    expect(res.status).toBe(400);
  });

  it("rejects a lowercase platform with 400 — the schema requires exact-case WEB/IOS/ANDROID, no normalization", async () => {
    const res = await POST(makeRequest("POST", { endpoint: "https://push.example.com/abc", platform: "web" }));
    expect(res.status).toBe(400);
  });

  it("registers a valid subscription", async () => {
    mockUpsert.mockResolvedValue({ id: "push_1" });
    const res = await POST(makeRequest("POST", { endpoint: "https://push.example.com/abc", platform: "WEB" }));
    expect(res.status).toBe(200);
    expect(mockUpsert).toHaveBeenCalledTimes(1);
    const args = mockUpsert.mock.calls[0]![0];
    expect(args.create.platform).toBe("WEB");
    expect(args.where.endpoint).toBe("https://push.example.com/abc");
  });
});

describe("DELETE /api/push/subscribe", () => {
  beforeEach(() => mockUpdateMany.mockReset());

  it("rejects a missing endpoint query param with 400", async () => {
    const res = await DELETE(makeRequest("DELETE", undefined, "http://localhost/api/push/subscribe"));
    expect(res.status).toBe(400);
  });

  it("deactivates the subscription for a given endpoint", async () => {
    mockUpdateMany.mockResolvedValue({ count: 1 });
    const res = await DELETE(
      makeRequest("DELETE", undefined, "http://localhost/api/push/subscribe?endpoint=https://push.example.com/abc")
    );
    expect(res.status).toBe(200);
    expect(mockUpdateMany).toHaveBeenCalledWith({
      where: { endpoint: "https://push.example.com/abc" },
      data: { active: false },
    });
  });
});
