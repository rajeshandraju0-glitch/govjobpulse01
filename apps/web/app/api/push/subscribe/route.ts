// Section 8: "Push notifications: OneSignal or Firebase as an optional
// provider; subscription API, device registration, admin config —
// disabled by default." This registers a device/browser endpoint;
// actual push sending still goes through PushProvider
// (packages/notifications), which — same as Email — has no real
// subscriber list to iterate yet beyond a single test token. This
// endpoint is what Phase 12+ wiring would query to get that real list.

import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma, PushPlatform } from "@govjobpulse/database";
import { rateLimitRequest } from "@/lib/rate-limit";

const pushSubscribeSchema = z.object({
  endpoint: z.string().trim().min(1).max(2000), // real push endpoints are long URLs; bounded, not unbounded
  platform: z.enum(["WEB", "IOS", "ANDROID"]),
});

export async function POST(request: Request): Promise<NextResponse> {
  const rateLimit = await rateLimitRequest(request, "push-subscribe", 10, 60 * 60);
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 });
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = pushSubscribeSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json({ error: "endpoint and a valid platform (WEB, IOS, ANDROID) are required" }, { status: 400 });
  }
  const { endpoint, platform } = parsed.data;

  await prisma.pushSubscription.upsert({
    where: { endpoint },
    update: { active: true, lastSeenAt: new Date() },
    create: { endpoint, platform: platform as PushPlatform, active: true },
  });

  return NextResponse.json({ message: "Push subscription registered." });
}

export async function DELETE(request: Request): Promise<NextResponse> {
  const endpoint = new URL(request.url).searchParams.get("endpoint");
  if (!endpoint) {
    return NextResponse.json({ error: "endpoint query param is required" }, { status: 400 });
  }

  await prisma.pushSubscription.updateMany({
    where: { endpoint },
    data: { active: false },
  });

  return NextResponse.json({ message: "Push subscription deactivated." });
}
