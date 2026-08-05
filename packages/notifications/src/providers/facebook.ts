// Facebook Graph API — posting to a Page's feed:
// https://developers.facebook.com/docs/graph-api/reference/page/feed/
// Requires a Page Access Token with pages_manage_posts permission,
// which needs Meta App Review for anything beyond a handful of test
// users/roles — same external-approval caveat Section 7 calls out.

import { BaseNotificationProvider } from "../base-provider";
import type { NotificationJobPayload } from "@govjobpulse/types";

export class FacebookProvider extends BaseNotificationProvider {
  slug = "facebook";
  name = "Facebook";

  constructor(private env: NodeJS.ProcessEnv = process.env, private fetchImpl: typeof fetch = fetch) {
    super();
  }

  isEnabled(): boolean {
    return Boolean(this.env.FACEBOOK_PAGE_ID && this.env.FACEBOOK_PAGE_ACCESS_TOKEN);
  }

  protected async doSendJob(job: NotificationJobPayload): Promise<void> {
    const pageId = this.env.FACEBOOK_PAGE_ID;
    const token = this.env.FACEBOOK_PAGE_ACCESS_TOKEN;
    const message = this.formatMessage(job);

    const res = await this.fetchImpl(
      `https://graph.facebook.com/v19.0/${pageId}/feed?access_token=${token}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, link: job.url }),
      }
    );

    if (!res.ok) throw new Error(`Facebook Graph API returned HTTP ${res.status}`);
  }

  protected async doHealthCheck(): Promise<string> {
    const pageId = this.env.FACEBOOK_PAGE_ID;
    const token = this.env.FACEBOOK_PAGE_ACCESS_TOKEN;
    const res = await this.fetchImpl(`https://graph.facebook.com/v19.0/${pageId}?access_token=${token}`);
    if (!res.ok) throw new Error(`Facebook Graph API page lookup returned HTTP ${res.status}`);
    return "Facebook page access token is valid.";
  }

  formatMessage(job: NotificationJobPayload): string {
    const parts = [job.title, job.organizationName];
    if (job.applicationEnd) {
      parts.push(
        `Last date: ${job.applicationEnd.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}`
      );
    }
    return parts.join("\n");
  }
}
