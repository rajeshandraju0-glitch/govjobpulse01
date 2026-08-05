import { describe, it, expect, vi } from "vitest";
import { TelegramProvider } from "../src/providers/telegram";
import { FacebookProvider } from "../src/providers/facebook";
import { InstagramProvider } from "../src/providers/instagram";
import { LinkedInProvider } from "../src/providers/linkedin";
import { WhatsAppProvider } from "../src/providers/whatsapp";
import { EmailProvider } from "../src/providers/email";
import { PushProvider } from "../src/providers/push";
import { TwitterProvider } from "../src/providers/twitter";
import { createProviderRegistry, getProvider } from "../src/registry";
import type { NotificationJobPayload } from "@govjobpulse/types";

const SAMPLE_JOB: NotificationJobPayload = {
  jobId: "job_1",
  slug: "technician-b",
  title: "Recruitment to the post of Technician 'B'",
  organizationName: "ISRO",
  applicationEnd: new Date("2026-07-20"),
  url: "https://www.govjobpulse.com/jobs/technician-b",
};

function mockFetch(ok = true, body: unknown = {}) {
  return vi.fn().mockResolvedValue({
    ok,
    status: ok ? 200 : 401,
    json: async () => body,
    text: async () => JSON.stringify(body),
  }) as unknown as typeof fetch;
}

describe("every provider is disabled by default with an empty environment", () => {
  const cases: Array<[string, () => { isEnabled(): boolean }]> = [
    ["telegram", () => new TelegramProvider({})],
    ["facebook", () => new FacebookProvider({})],
    ["instagram", () => new InstagramProvider({})],
    ["linkedin", () => new LinkedInProvider({})],
    ["whatsapp", () => new WhatsAppProvider({})],
    ["email", () => new EmailProvider({})],
    ["push", () => new PushProvider({})],
    ["twitter", () => new TwitterProvider({})],
  ];

  it.each(cases)("%s.isEnabled() is false with no credentials set", (_slug, factory) => {
    expect(factory().isEnabled()).toBe(false);
  });
});

describe("registry", () => {
  it("registers all 8 platforms from Section 7", () => {
    const registry = createProviderRegistry();
    expect(registry).toHaveLength(8);
    expect(registry.map((p) => p.slug).sort()).toEqual(
      ["email", "facebook", "instagram", "linkedin", "push", "telegram", "twitter", "whatsapp"].sort()
    );
  });

  it("getProvider finds a provider by slug", () => {
    expect(getProvider("telegram")).toBeDefined();
    expect(getProvider("nonexistent")).toBeUndefined();
  });

  it("every registered provider is disabled by default (registry uses process.env, which has no test credentials)", () => {
    for (const provider of createProviderRegistry()) {
      expect(provider.isEnabled()).toBe(false);
    }
  });
});

describe("TelegramProvider — enabled request shape", () => {
  it("posts to the correct Bot API URL with the right payload when enabled", async () => {
    const fetchImpl = mockFetch();
    const provider = new TelegramProvider(
      { TELEGRAM_BOT_TOKEN: "test-token", TELEGRAM_CHAT_ID: "-100123" },
      fetchImpl
    );
    expect(provider.isEnabled()).toBe(true);

    const result = await provider.sendJob(SAMPLE_JOB);

    expect(result.status).toBe("SENT");
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://api.telegram.org/bottest-token/sendMessage",
      expect.objectContaining({ method: "POST" })
    );
    const body = JSON.parse((fetchImpl as any).mock.calls[0][1].body);
    expect(body.chat_id).toBe("-100123");
    expect(body.text).toContain("Technician 'B'");
    expect(body.text).toContain(SAMPLE_JOB.url);
  });

  it("reports FAILED (not thrown) when the Telegram API returns a non-OK status", async () => {
    const fetchImpl = mockFetch(false);
    const provider = new TelegramProvider(
      { TELEGRAM_BOT_TOKEN: "bad-token", TELEGRAM_CHAT_ID: "-100123" },
      fetchImpl
    );
    const result = await provider.sendJob(SAMPLE_JOB);
    expect(result.status).toBe("FAILED");
  });
});

describe("FacebookProvider — enabled request shape", () => {
  it("posts to the correct Graph API feed endpoint", async () => {
    const fetchImpl = mockFetch();
    const provider = new FacebookProvider(
      { FACEBOOK_PAGE_ID: "12345", FACEBOOK_PAGE_ACCESS_TOKEN: "test-token" },
      fetchImpl
    );
    await provider.sendJob(SAMPLE_JOB);
    const [url] = (fetchImpl as any).mock.calls[0];
    expect(url).toContain("graph.facebook.com/v19.0/12345/feed");
    expect(url).toContain("access_token=test-token");
  });
});

describe("TwitterProvider — message formatting stays within the 280-char cap", () => {
  it("truncates a long title rather than exceeding Twitter's length limit", () => {
    const provider = new TwitterProvider({ TWITTER_USER_ACCESS_TOKEN: "t" });
    const longJob = {
      ...SAMPLE_JOB,
      title:
        "Recruitment to the posts of Technician 'B', Draughtsman 'B', Technical Assistant, Scientific Assistant, Library Assistant 'A' and Cook 'A' across multiple ISRO centres nationwide",
    };
    const message = provider.formatMessage(longJob);
    expect(message.length).toBeLessThanOrEqual(280);
    expect(message).toContain(longJob.url);
  });

  it("does not truncate a short title unnecessarily", () => {
    const provider = new TwitterProvider({ TWITTER_USER_ACCESS_TOKEN: "t" });
    const message = provider.formatMessage(SAMPLE_JOB);
    expect(message).toContain("Technician 'B'");
    expect(message).not.toContain("…");
  });
});

describe("WhatsAppProvider — requires all four credentials, not just some", () => {
  it("is disabled if only some of the required vars are set", () => {
    const provider = new WhatsAppProvider({
      WHATSAPP_PHONE_NUMBER_ID: "1",
      WHATSAPP_ACCESS_TOKEN: "2",
      // missing WHATSAPP_CHANNEL_ID and WHATSAPP_TEMPLATE_NAME
    });
    expect(provider.isEnabled()).toBe(false);
  });

  it("is enabled only once all four required vars are present", () => {
    const provider = new WhatsAppProvider({
      WHATSAPP_PHONE_NUMBER_ID: "1",
      WHATSAPP_ACCESS_TOKEN: "2",
      WHATSAPP_CHANNEL_ID: "3",
      WHATSAPP_TEMPLATE_NAME: "job_alert",
    });
    expect(provider.isEnabled()).toBe(true);
  });
});

describe("EmailProvider and PushProvider — fail clearly, not silently, without a subscriber list (Phase 10)", () => {
  it("EmailProvider.sendJob fails with a clear message when no test recipient is configured", async () => {
    const provider = new EmailProvider(
      { EMAIL_API_KEY: "k", EMAIL_FROM_ADDRESS: "noreply@govjobpulse.com" },
      mockFetch()
    );
    const result = await provider.sendJob(SAMPLE_JOB);
    expect(result.status).toBe("FAILED");
    expect(result.errorMessage).toMatch(/subscriber list/i);
  });

  it("PushProvider.sendJob fails with a clear message when no test device token is configured", async () => {
    const provider = new PushProvider({ FCM_PROJECT_ID: "p", FCM_SERVER_KEY: "k" }, mockFetch());
    const result = await provider.sendJob(SAMPLE_JOB);
    expect(result.status).toBe("FAILED");
    expect(result.errorMessage).toMatch(/subscriber list/i);
  });
});
