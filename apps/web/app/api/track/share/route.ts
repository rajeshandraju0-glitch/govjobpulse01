import { NextResponse } from "next/server";
import { trackShareEvent } from "@/lib/analytics";

const VALID_CHANNELS = new Set(["FACEBOOK", "LINKEDIN", "TWITTER", "TELEGRAM", "WHATSAPP", "COPY_LINK"]);

export async function POST(request: Request): Promise<NextResponse> {
  let body: { jobId?: string; channel?: string };
  try {
    body = (await request.json()) as { jobId?: string; channel?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.jobId || !body.channel || !VALID_CHANNELS.has(body.channel)) {
    return NextResponse.json({ error: "jobId and a valid channel are required" }, { status: 400 });
  }

  try {
    await trackShareEvent(body.jobId, body.channel as Parameters<typeof trackShareEvent>[1]);
  } catch (err) {
    // A tracking failure should never surface as an error to the
    // person sharing a job — log it, respond success-shaped anyway.
    console.error("[analytics] Failed to track share event:", err);
  }

  return NextResponse.json({ ok: true });
}
