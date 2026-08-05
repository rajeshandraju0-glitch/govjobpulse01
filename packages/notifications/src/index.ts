// Section 7: notification adapters, one per platform, all disabled by
// default. See base-provider.ts for the shared gating logic and
// registry.ts for the full list of 8 providers.

export * from "./base-provider";
export * from "./registry";
export * from "./queues/config";
export * from "./queues/dead-letter";
export * from "./providers/telegram";
export * from "./providers/facebook";
export * from "./providers/instagram";
export * from "./providers/linkedin";
export * from "./providers/whatsapp";
export * from "./providers/email";
export * from "./providers/push";
export * from "./providers/twitter";
