// X (Twitter) API v2 — posting a tweet:
// https://developer.twitter.com/en/docs/twitter-api/tweets/manage-tweets/api-reference/post-tweets
// Needs an OAuth 2.0 user context bearer token (not just an app-only
// bearer token — posting requires user context). Real request shape;
// cannot be exercised without real credentials, same as every other
// adapter here.

import { BaseNotificationProvider } from "../base-provider";
import type { NotificationJobPayload } from "@govjobpulse/types";

export class TwitterProvider extends BaseNotificationProvider {
  slug = "twitter";
  name = "X (Twitter)";

  constructor(private env: NodeJS.ProcessEnv = process.env, private fetchImpl: typeof fetch = fetch) {
    super();
  }

  isEnabled(): boolean {
    return Boolean(this.env.TWITTER_USER_ACCESS_TOKEN);
  }

  protected async doSendJob(job: NotificationJobPayload): Promise<void> {
    const token = this.env.TWITTER_USER_ACCESS_TOKEN;
    const text = this.formatMessage(job);

    const res = await this.fetchImpl("https://api.twitter.com/2/tweets", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ text }),
    });

    if (!res.ok) throw new Error(`Twitter API returned HTTP ${res.status}`);
  }

  protected async doHealthCheck(): Promise<string> {
    const token = this.env.TWITTER_USER_ACCESS_TOKEN;
    const res = await this.fetchImpl("https://api.twitter.com/2/users/me", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`Twitter token check returned HTTP ${res.status}`);
    return "Twitter access token is valid.";
  }

  formatMessage(job: NotificationJobPayload): string {
    // Tweets are hard-capped at 280 characters — build with the URL
    // reserved first (Twitter counts t.co-shortened links at a fixed
    // ~23 chars regardless of actual length), then truncate the title
    // to fit rather than let fetch() fail on an oversized payload.
    const urlReserve = 24; // 23 + 1 space, per Twitter's t.co convention
    const suffix = job.applicationEnd
      ? ` — closes ${job.applicationEnd.toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}`
      : "";
    const maxTitleLength = 280 - urlReserve - suffix.length - 1;
    const title = job.title.length > maxTitleLength ? `${job.title.slice(0, maxTitleLength - 1)}…` : job.title;
    return `${title}${suffix}\n${job.url}`;
  }
}
