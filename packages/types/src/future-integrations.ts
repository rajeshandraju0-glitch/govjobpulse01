// Section 12: "Future integration placeholders (interfaces only — do
// not implement): AI summaries, resume builder, exam preparation
// tools, public REST API, browser extension, Android/iOS apps. Define
// the interface shape now so these can be added later without
// refactoring core modules; do not build functionality behind them
// yet, and do not scaffold empty directories for things with no
// interface defined."
//
// Every interface below is grounded in what already exists in this
// codebase (Job, User, NotificationJobPayload, etc.) rather than
// invented in a vacuum — each has a one-line note on how it would
// connect to real modules if implemented. Nothing here has a runtime
// implementation; that's the point of this phase.
//
// Deliberately no import from "./index" here (even though
// NotificationJobPayload, referenced in comments below, lives there) —
// index.ts re-exports this whole file via `export * from
// "./future-integrations"`, so importing back from index.ts would be
// circular. Consumers who need NotificationJobPayload get it directly
// from the main package export; this file doesn't need to re-export it.

// ---------------------------------------------------------------------------
// 1. AI summaries
// ---------------------------------------------------------------------------

/** Plain job fields an AI summarizer would need — deliberately a subset
 * of the real `Job` model (packages/database), not the whole row, so
 * a summarizer implementation doesn't need a direct Prisma dependency. */
export interface JobSummaryInput {
  title: string;
  description: string;
  qualifications: string[];
  department: string;
  organizationName: string;
}

export interface JobSummaryResult {
  summary: string;
  keyPoints: string[];
  modelUsed: string;
  generatedAt: Date;
}

/** Would sit alongside packages/notifications' provider pattern —
 * same "isolated, independently swappable implementation" shape, just
 * for a different kind of external service (an LLM API, not a social
 * platform). A real implementation would be invoked from the job
 * detail page (apps/web) to render an optional "AI summary" section,
 * or from the moderation queue (apps/admin) to help a reviewer triage
 * faster — neither exists yet. */
export interface JobSummaryProvider {
  slug: string;
  summarize(input: JobSummaryInput): Promise<JobSummaryResult>;
}

// ---------------------------------------------------------------------------
// 2. Resume builder
// ---------------------------------------------------------------------------

export interface ResumeInput {
  userId: string; // ties to the User model — needs the "Registered User"
                   // auth flow that CLAUDE.md's open items note is still
                   // unbuilt (Phase 14 only built ADMIN/SUPER_ADMIN auth)
  fullName: string;
  education: { institution: string; qualification: string; year: number }[];
  experience: { organization: string; role: string; years: number }[];
  targetJobId?: string; // optional — tailor the resume toward a specific Job
}

export interface ResumeDocument {
  id: string;
  format: "pdf" | "docx";
  downloadUrl: string;
  createdAt: Date;
}

export interface ResumeBuilderProvider {
  generateResume(input: ResumeInput): Promise<ResumeDocument>;
}

// ---------------------------------------------------------------------------
// 3. Exam preparation tools
// ---------------------------------------------------------------------------

export interface QuizQuestion {
  question: string;
  options: string[];
  correctOptionIndex: number;
}

export interface Quiz {
  id: string;
  jobId: string; // ties a quiz to a specific Job's exam, not generic
  questions: QuizQuestion[];
}

export interface StudyMaterial {
  title: string;
  content: string;
  /** Matches Section 3's Category taxonomy (e.g. "Bank", "Railway") —
   * study material would be organized the same way jobs already are,
   * not a separate, disconnected taxonomy. */
  categorySlug: string;
}

export interface ExamPrepProvider {
  getQuizForJob(jobId: string): Promise<Quiz | null>;
  getStudyMaterial(categorySlug: string): Promise<StudyMaterial[]>;
}

// ---------------------------------------------------------------------------
// 4. Public REST API
// ---------------------------------------------------------------------------
// Section 10 (Phase 10's CLAUDE.md entry) already documents WHY no
// apps/api exists yet: every phase since 6 used Next.js Route
// Handlers/Server Actions directly, and nothing built so far needed a
// framework-independent surface. This is the response SHAPE a future
// public API would use, grounded in the same pagination pattern
// apps/web already applies everywhere (lib/pagination.ts's
// clampPageSize) rather than inventing a new one.

export interface PublicApiJob {
  id: string;
  title: string;
  slug: string;
  organization: string;
  department: string;
  category: string;
  applicationEnd: string | null; // ISO 8601 — a public API returns
                                   // strings, not Date objects, to stay
                                   // JSON-schema-stable across clients
  officialNotificationUrl: string;
  url: string; // absolute link to the GovJobPulse job page
}

export interface PublicApiListResponse<T> {
  data: T[];
  page: number;
  pageSize: number;
  total: number;
}

/** What an API-key-authenticated request would carry — rate limiting
 * reuses packages/cache's checkRateLimit() shape (Phase 14), just
 * keyed by API key instead of IP address. */
export interface PublicApiAuthContext {
  apiKeyId: string;
  rateLimit: { limit: number; remaining: number };
}

// ---------------------------------------------------------------------------
// 5. Browser extension
// ---------------------------------------------------------------------------
// A browser extension's most obvious value-add over the public site:
// detecting when someone's looking at a job posting on a *different*
// site (an official government portal, say) and offering to save/track
// it here. That's the shape below — not a full extension API, just the
// message contract between an extension and GovJobPulse.

export interface ExtensionDetectedJob {
  sourceUrl: string;
  detectedTitle: string | null;
  detectedOrganization: string | null;
}

export type ExtensionMessage =
  | { type: "JOB_DETECTED"; payload: ExtensionDetectedJob }
  | { type: "SAVE_JOB_REQUEST"; payload: { sourceUrl: string } }
  | { type: "SAVE_JOB_RESULT"; payload: { success: boolean; jobId?: string; error?: string } };

// ---------------------------------------------------------------------------
// 6. Android/iOS apps
// ---------------------------------------------------------------------------
// Worth naming explicitly: push notification device registration
// ALREADY EXISTS for this (PushSubscription model + POST
// /api/push/subscribe, Phase 10) — a mobile app would use that
// unchanged, not a new interface. What's genuinely new for a native
// client is deep-linking (routing a push notification tap or shared
// link to the right in-app screen) and a lightweight app-version gate.

export interface MobileDeepLink {
  /** Matches apps/web's real route shape — /jobs/[slug], /categories/[slug],
   * etc. — so a native client's router can stay a thin mapping onto
   * routes that already exist, not a parallel navigation structure. */
  path: string;
  jobId?: string;
}

export interface MobileAppConfig {
  platform: "ios" | "android";
  minSupportedVersion: string;
  /** For a forced-update gate — if a shipped app version predates a
   * breaking API/schema change, the app should know to prompt an update
   * rather than fail unpredictably against a public API it doesn't
   * understand yet. */
  forceUpdateBelowVersion: string | null;
}

// Note: a mobile client would send the same NotificationJobPayload
// shape (exported directly from this package's index.ts) that a push
// adapter already sends — not a mobile-specific duplicate of it.
