// Push notification adapter. Section 7 lists Push as one of the 8
// platforms (the "send" capability); Section 8's device-registration/
// subscription API is separate, later work (Phase 10) — same split as
// the Email adapter. Implemented against Firebase Cloud Messaging's
// HTTP v1 API as a concrete example (OneSignal is Section 8's other
// named option; swapping is a matter of changing the fetch call, same
// as the Email adapter's SendGrid-vs-other-provider note).

import { BaseNotificationProvider } from "../base-provider";
import type { NotificationJobPayload } from "@govjobpulse/types";

export class PushProvider extends BaseNotificationProvider {
  slug = "push";
  name = "Push Notifications";

  constructor(private env: NodeJS.ProcessEnv = process.env, private fetchImpl: typeof fetch = fetch) {
    super();
  }

  isEnabled(): boolean {
    return Boolean(this.env.FCM_PROJECT_ID && this.env.FCM_SERVER_KEY);
  }

  /**
   * Same caveat as Email's sendJob(): no subscriber/device-token list
   * exists yet (Phase 10). Sends to a single test device token so the
   * adapter itself is exercisable/testable independent of that
   * missing piece.
   */
  protected async doSendJob(job: NotificationJobPayload): Promise<void> {
    const deviceToken = this.env.PUSH_NOTIFICATION_TEST_DEVICE_TOKEN;
    if (!deviceToken) {
      throw new Error(
        "PUSH_NOTIFICATION_TEST_DEVICE_TOKEN not set — Push provider has no subscriber list yet (Phase 10)."
      );
    }

    const res = await this.fetchImpl(
      `https://fcm.googleapis.com/v1/projects/${this.env.FCM_PROJECT_ID}/messages:send`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.env.FCM_SERVER_KEY}`,
        },
        body: JSON.stringify({
          message: {
            token: deviceToken,
            notification: { title: job.title, body: job.organizationName },
            data: { url: job.url },
          },
        }),
      }
    );

    if (!res.ok) throw new Error(`FCM API returned HTTP ${res.status}`);
  }

  protected async doHealthCheck(): Promise<string> {
    // FCM has no lightweight "check my credentials" endpoint the way
    // SendGrid/Telegram do — validity is really only confirmed by a
    // send attempt. Treat presence of both required vars as the health
    // signal, and note that explicitly rather than pretending a real
    // check happened.
    return "FCM project ID and server key are present (FCM has no separate credential-validation endpoint).";
  }
}
