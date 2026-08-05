// LinkedIn UGC Posts API — sharing to an Organization page:
// https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/ugc-post-api
// Requires the Marketing Developer Platform program (w_organization_social
// scope) — an application + LinkedIn review process, same external-
// approval caveat Section 7 explicitly flags for Instagram/LinkedIn/
// WhatsApp Channels. Unlike Instagram, LinkedIn's API itself supports a
// plain text+link share with no image requirement, so there's no second
// structural constraint here — just the review gate.

import { BaseNotificationProvider } from "../base-provider";
import type { NotificationJobPayload } from "@govjobpulse/types";

export class LinkedInProvider extends BaseNotificationProvider {
  slug = "linkedin";
  name = "LinkedIn";

  constructor(private env: NodeJS.ProcessEnv = process.env, private fetchImpl: typeof fetch = fetch) {
    super();
  }

  isEnabled(): boolean {
    return Boolean(this.env.LINKEDIN_ORGANIZATION_URN && this.env.LINKEDIN_ACCESS_TOKEN);
  }

  protected async doSendJob(job: NotificationJobPayload): Promise<void> {
    const orgUrn = this.env.LINKEDIN_ORGANIZATION_URN; // e.g. "urn:li:organization:12345"
    const token = this.env.LINKEDIN_ACCESS_TOKEN;

    const res = await this.fetchImpl("https://api.linkedin.com/v2/ugcPosts", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        "X-Restli-Protocol-Version": "2.0.0",
      },
      body: JSON.stringify({
        author: orgUrn,
        lifecycleState: "PUBLISHED",
        specificContent: {
          "com.linkedin.ugc.ShareContent": {
            shareCommentary: { text: this.formatMessage(job) },
            shareMediaCategory: "ARTICLE",
            media: [{ status: "READY", originalUrl: job.url }],
          },
        },
        visibility: { "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC" },
      }),
    });

    if (!res.ok) throw new Error(`LinkedIn UGC Posts API returned HTTP ${res.status}`);
  }

  protected async doHealthCheck(): Promise<string> {
    const token = this.env.LINKEDIN_ACCESS_TOKEN;
    const res = await this.fetchImpl("https://api.linkedin.com/v2/userinfo", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`LinkedIn token check returned HTTP ${res.status}`);
    return "LinkedIn access token is valid.";
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
