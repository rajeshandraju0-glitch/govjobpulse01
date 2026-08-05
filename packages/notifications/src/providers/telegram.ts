// Telegram Bot API: https://core.telegram.org/bots/api#sendmessage
// Chosen as the reference implementation other adapters mirror — no
// OAuth flow, no business app review, just a bot token + chat/channel
// id. Real, correct request shape; genuinely cannot be exercised against
// the live API without a real bot token (none exists in this sandbox or
// any dev environment until an admin configures one via Phase 9's panel).

import { BaseNotificationProvider } from "../base-provider";
import type { NotificationJobPayload } from "@govjobpulse/types";

export class TelegramProvider extends BaseNotificationProvider {
  slug = "telegram";
  name = "Telegram";

  constructor(private env: NodeJS.ProcessEnv = process.env, private fetchImpl: typeof fetch = fetch) {
    super();
  }

  isEnabled(): boolean {
    return Boolean(this.env.TELEGRAM_BOT_TOKEN && this.env.TELEGRAM_CHAT_ID);
  }

  protected async doSendJob(job: NotificationJobPayload): Promise<void> {
    const token = this.env.TELEGRAM_BOT_TOKEN;
    const chatId = this.env.TELEGRAM_CHAT_ID;
    const text = this.formatMessage(job);

    const res = await this.fetchImpl(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML", disable_web_page_preview: false }),
    });

    if (!res.ok) {
      throw new Error(`Telegram API returned HTTP ${res.status}`);
    }
  }

  protected async doHealthCheck(): Promise<string> {
    const token = this.env.TELEGRAM_BOT_TOKEN;
    const res = await this.fetchImpl(`https://api.telegram.org/bot${token}/getMe`);
    if (!res.ok) throw new Error(`Telegram getMe returned HTTP ${res.status}`);
    return "Telegram bot token is valid.";
  }

  formatMessage(job: NotificationJobPayload): string {
    const lines = [`<b>${escapeHtml(job.title)}</b>`, escapeHtml(job.organizationName)];
    if (job.applicationEnd) {
      lines.push(
        `Last date: ${job.applicationEnd.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}`
      );
    }
    lines.push(job.url);
    return lines.join("\n");
  }
}

function escapeHtml(input: string): string {
  return input.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
