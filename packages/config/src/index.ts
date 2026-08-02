// GovJobPulse env/config loader.
// Section 1, rule 7: no hardcoded secrets; all config via env vars,
// validated at boot with a clear failure if something required is missing.
//
// TODO: as each phase introduces new env vars (DATABASE_URL in Phase 2,
// REDIS_URL in Phase 4/8, JWT_SECRET in Phase 14, notification provider
// credentials in Phase 8, etc.), extend `envSchema` below and re-export
// the parsed, typed config. Each app should import from here rather than
// reading process.env directly, so a missing var fails fast at boot with
// a readable error instead of surfacing as an obscure runtime bug later.

import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  DATABASE_URL: z.string().url().startsWith("postgresql://", {
    message: "DATABASE_URL must be a postgresql:// connection string",
  }),
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(
      `Invalid/missing environment variables:\n${issues}\n\nCheck .env against .env.example.`
    );
  }
  return parsed.data;
}
