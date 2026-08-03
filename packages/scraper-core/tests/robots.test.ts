import { describe, it, expect, vi } from "vitest";
import { checkRobotsAllowed } from "../src/robots";

function mockFetch(body: string, ok = true, status = 200) {
  return vi.fn().mockResolvedValue({
    ok,
    status,
    text: async () => body,
  }) as unknown as typeof fetch;
}

describe("checkRobotsAllowed", () => {
  it("allows a path not covered by any Disallow rule", async () => {
    const fetchImpl = mockFetch("User-agent: *\nDisallow: /admin/\n");
    const result = await checkRobotsAllowed("https://example.gov.in", "/Careers.html", fetchImpl);
    expect(result.allowed).toBe(true);
  });

  it("disallows a path covered by a Disallow rule for our user agent", async () => {
    const fetchImpl = mockFetch("User-agent: *\nDisallow: /Careers.html\n");
    const result = await checkRobotsAllowed("https://example.gov.in", "/Careers.html", fetchImpl);
    expect(result.allowed).toBe(false);
  });

  it("treats a missing robots.txt (404) as unrestricted but flags it for review", async () => {
    const fetchImpl = mockFetch("", false, 404);
    const result = await checkRobotsAllowed("https://example.gov.in", "/Careers.html", fetchImpl);
    expect(result.allowed).toBe(true);
    expect(result.notes).toMatch(/404/);
  });

  it("fails CLOSED (not open) on a network error fetching robots.txt", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error("network down")) as unknown as typeof fetch;
    const result = await checkRobotsAllowed("https://example.gov.in", "/Careers.html", fetchImpl);
    expect(result.allowed).toBe(false);
    expect(result.notes).toMatch(/network down/);
  });
});
