import { NextResponse } from "next/server";
import { z } from "zod";
import { trackShareEvent } from "@/lib/analytics";
import { rateLimitRequest } from "@/lib/rate-limit";

const trackShareSchema = z.object({
  jobId: z.string().min(1),
  channel: z.enum(["FACEBOOK", "LINKEDIN", "TWITTER", "TELEGRAM", "WHATSAPP", "COPY_LINK"]),
});

export async function POST(request: Request): Promise<NextResponse> {
  // Higher limit than subscribe — a real person could legitimately
  // share several jobs across platforms in a session; this is aimed at
  // bulk automated hits inflating "most shared" analytics, not normal use.
  const rateLimit = await rateLimitRequest(request, "track-share", 60, 60 * 60);
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = trackShareSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json({ error: "jobId and a valid channel are required" }, { status: 400 });
  }

  try {
    await trackShareEvent(parsed.data.jobId, parsed.data.channel);
  } catch (err) {
    // A tracking failure should never surface as an error to the
    // person sharing a job — log it, respond success-shaped anyway.
    console.error("[analytics] Failed to track share event:", err);
  }

  return NextResponse.json({ ok: true });
}
