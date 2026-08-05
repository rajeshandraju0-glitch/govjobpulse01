import type { NotificationProvider } from "@govjobpulse/types";
import { TelegramProvider } from "./providers/telegram";
import { FacebookProvider } from "./providers/facebook";
import { InstagramProvider } from "./providers/instagram";
import { LinkedInProvider } from "./providers/linkedin";
import { WhatsAppProvider } from "./providers/whatsapp";
import { EmailProvider } from "./providers/email";
import { PushProvider } from "./providers/push";
import { TwitterProvider } from "./providers/twitter";

// Section 7's 8 platforms. Every provider is disabled by default (no
// credentials present in a fresh environment) — see base-provider.ts
// for the two-layer gating this relies on.
export function createProviderRegistry(): NotificationProvider[] {
  return [
    new TelegramProvider(),
    new FacebookProvider(),
    new InstagramProvider(),
    new LinkedInProvider(),
    new WhatsAppProvider(),
    new EmailProvider(),
    new PushProvider(),
    new TwitterProvider(),
  ];
}

export function getProvider(slug: string): NotificationProvider | undefined {
  return createProviderRegistry().find((p) => p.slug === slug);
}
