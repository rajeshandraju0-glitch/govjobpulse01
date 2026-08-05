// Instagram Graph API — publishing a feed post:
// https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/content-publishing
//
// TWO separate gates here, not just one:
//   1. Meta App Review for instagram_content_publish permission —
//      external approval process, same as Facebook/WhatsApp above.
//   2. A fundamental API constraint, not a review gate: Instagram has
//      no "plain text status update" post type — every feed post needs
//      an image or video container. This adapter uses the job's OG
//      image (apps/web/app/jobs/[slug]/opengraph-image.tsx, built in
//      Phase 7) as that image, since GovJobPulse already generates one
//      per job — rather than leaving this adapter as a bare TODO, it
//      reuses infrastructure that already exists for a different
//      purpose. Still gated behind isEnabled() same as every adapter.

import { BaseNotificationProvider } from "../base-provider";
import type { NotificationJobPayload } from "@govjobpulse/types";

export class InstagramProvider extends BaseNotificationProvider {
  slug = "instagram";
  name = "Instagram";

  constructor(private env: NodeJS.ProcessEnv = process.env, private fetchImpl: typeof fetch = fetch) {
    super();
  }

  isEnabled(): boolean {
    return Boolean(this.env.INSTAGRAM_BUSINESS_ACCOUNT_ID && this.env.INSTAGRAM_ACCESS_TOKEN);
  }

  protected async doSendJob(job: NotificationJobPayload): Promise<void> {
    const accountId = this.env.INSTAGRAM_BUSINESS_ACCOUNT_ID;
    const token = this.env.INSTAGRAM_ACCESS_TOKEN;
    // Instagram's opengraph-image.tsx route is publicly reachable at
    // this path — that's the "image" a container needs, no separate
    // asset pipeline required.
    const imageUrl = `${job.url}/opengraph-image`;
    const caption = this.formatMessage(job);

    // Step 1: create a media container.
    const containerRes = await this.fetchImpl(
      `https://graph.facebook.com/v19.0/${accountId}/media?access_token=${token}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image_url: imageUrl, caption }),
      }
    );
    if (!containerRes.ok) throw new Error(`Instagram container creation returned HTTP ${containerRes.status}`);
    const { id: containerId } = (await containerRes.json()) as { id: string };

    // Step 2: publish that container.
    const publishRes = await this.fetchImpl(
      `https://graph.facebook.com/v19.0/${accountId}/media_publish?access_token=${token}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ creation_id: containerId }),
      }
    );
    if (!publishRes.ok) throw new Error(`Instagram publish returned HTTP ${publishRes.status}`);
  }

  protected async doHealthCheck(): Promise<string> {
    const accountId = this.env.INSTAGRAM_BUSINESS_ACCOUNT_ID;
    const token = this.env.INSTAGRAM_ACCESS_TOKEN;
    const res = await this.fetchImpl(`https://graph.facebook.com/v19.0/${accountId}?access_token=${token}`);
    if (!res.ok) throw new Error(`Instagram business account lookup returned HTTP ${res.status}`);
    return "Instagram Business Account credentials are valid.";
  }

  formatMessage(job: NotificationJobPayload): string {
    const parts = [job.title, job.organizationName];
    if (job.applicationEnd) {
      parts.push(
        `Last date: ${job.applicationEnd.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}`
      );
    }
    parts.push("Link in bio / GovJobPulse.com");
    return parts.join("\n");
  }
}
