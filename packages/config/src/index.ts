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
  // Optional: only required by apps/worker's notification queues
  // (packages/notifications). Not required for web/admin/api, which
  // don't touch Redis directly — kept optional here rather than
  // splitting into a per-app schema, since the cost of one extra
  // optional field is lower than maintaining multiple schemas.
  REDIS_URL: z.string().url().startsWith("redis://", {
    message: "REDIS_URL must be a redis:// connection string",
  }).optional(),
  // Section 14: signs/verifies apps/admin's session JWTs
  // (packages/auth). Required, not optional — an admin deployment
  // with no JWT_SECRET set would either crash (good, fail-fast) or
  // worse, someone might hardcode a fallback (exactly what Section 1
  // rule 7 forbids). Minimum length is a real, checked constraint, not
  // just documentation — a short secret is meaningfully easier to
  // brute-force.
  JWT_SECRET: z.string().min(32, {
    message: "JWT_SECRET must be at least 32 characters — generate one with `openssl rand -hex 32`",
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
