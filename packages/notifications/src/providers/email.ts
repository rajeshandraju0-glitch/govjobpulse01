// Email adapter. Section 7 lists Email as one of the 8 notification
// platforms (the "send" capability); Section 8's subscriber
// list/digest scheduling is separate, later work (Phase 10) — this
// adapter sends to a single address per call, and the caller (worker,
// once Phase 10's subscriber list exists) is responsible for iterating
// recipients via sendBulk().
//
// Implemented against SendGrid's v3 Mail Send API shape as a concrete,
// realistic example — swap the fetch URL/payload for another provider
// (SES, Postmark, Resend, ...) without changing this class's public
// interface, since nothing outside this file depends on SendGrid
// specifically.

import { BaseNotificationProvider } from "../base-provider";
import type { NotificationJobPayload } from "@govjobpulse/types";

export class EmailProvider extends BaseNotificationProvider {
  slug = "email";
  name = "Email";

  constructor(private env: NodeJS.ProcessEnv = process.env, private fetchImpl: typeof fetch = fetch) {
    super();
  }

  isEnabled(): boolean {
    return Boolean(this.env.EMAIL_API_KEY && this.env.EMAIL_FROM_ADDRESS);
  }

  /**
   * sendJob() here sends to a single test/admin address
   * (EMAIL_NOTIFICATION_TEST_RECIPIENT) — this adapter has no concept
   * of a subscriber list yet (Phase 10). Once that exists, the caller
   * should use sendBulk() with one payload per subscriber, not expect
   * this class to know who to email.
   */
  protected async doSendJob(job: NotificationJobPayload): Promise<void> {
    const recipient = this.env.EMAIL_NOTIFICATION_TEST_RECIPIENT;
    if (!recipient) {
      throw new Error(
        "EMAIL_NOTIFICATION_TEST_RECIPIENT not set — Email provider has no subscriber list yet (Phase 10)."
      );
    }

    const res = await this.fetchImpl("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.env.EMAIL_API_KEY}`,
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: recipient }] }],
        from: { email: this.env.EMAIL_FROM_ADDRESS },
        subject: `New: ${job.title}`,
        content: [{ type: "text/plain", value: this.formatMessage(job) }],
      }),
    });

    if (!res.ok) throw new Error(`Email API returned HTTP ${res.status}`);
  }

  protected async doHealthCheck(): Promise<string> {
    // SendGrid's API key validation endpoint.
    const res = await this.fetchImpl("https://api.sendgrid.com/v3/scopes", {
      headers: { Authorization: `Bearer ${this.env.EMAIL_API_KEY}` },
    });
    if (!res.ok) throw new Error(`Email API key check returned HTTP ${res.status}`);
    return "Email API key is valid.";
  }

  formatMessage(job: NotificationJobPayload): string {
    const lines = [job.title, job.organizationName];
    if (job.applicationEnd) {
      lines.push(
        `Last date to apply: ${job.applicationEnd.toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" })}`
      );
    }
    lines.push(job.url);
    return lines.join("\n");
  }
}
