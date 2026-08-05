// WhatsApp Business Cloud API — sending to a Channel:
// https://developers.facebook.com/docs/whatsapp/cloud-api/guides/send-message-templates
// WhatsApp requires pre-approved message templates for outbound
// business-initiated messages (can't send arbitrary free text the way
// Telegram/Facebook allow) — this sends a templated message with the
// job details as template variables. Template approval is Meta's
// review process, same external-approval caveat as Instagram/LinkedIn
// below, though the API call itself doesn't need that review to exist
// in code.

import { BaseNotificationProvider } from "../base-provider";
import type { NotificationJobPayload } from "@govjobpulse/types";

export class WhatsAppProvider extends BaseNotificationProvider {
  slug = "whatsapp";
  name = "WhatsApp Channel";

  constructor(private env: NodeJS.ProcessEnv = process.env, private fetchImpl: typeof fetch = fetch) {
    super();
  }

  isEnabled(): boolean {
    return Boolean(
      this.env.WHATSAPP_PHONE_NUMBER_ID &&
        this.env.WHATSAPP_ACCESS_TOKEN &&
        this.env.WHATSAPP_CHANNEL_ID &&
        this.env.WHATSAPP_TEMPLATE_NAME
    );
  }

  protected async doSendJob(job: NotificationJobPayload): Promise<void> {
    const phoneNumberId = this.env.WHATSAPP_PHONE_NUMBER_ID;
    const token = this.env.WHATSAPP_ACCESS_TOKEN;

    const res = await this.fetchImpl(
      `https://graph.facebook.com/v19.0/${phoneNumberId}/messages`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: this.env.WHATSAPP_CHANNEL_ID,
          type: "template",
          template: {
            name: this.env.WHATSAPP_TEMPLATE_NAME,
            language: { code: "en" },
            components: [
              {
                type: "body",
                parameters: [
                  { type: "text", text: job.title },
                  { type: "text", text: job.organizationName },
                  { type: "text", text: job.url },
                ],
              },
            ],
          },
        }),
      }
    );

    if (!res.ok) throw new Error(`WhatsApp Cloud API returned HTTP ${res.status}`);
  }

  protected async doHealthCheck(): Promise<string> {
    const phoneNumberId = this.env.WHATSAPP_PHONE_NUMBER_ID;
    const token = this.env.WHATSAPP_ACCESS_TOKEN;
    const res = await this.fetchImpl(`https://graph.facebook.com/v19.0/${phoneNumberId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`WhatsApp phone number lookup returned HTTP ${res.status}`);
    return "WhatsApp Business API credentials are valid.";
  }
}
