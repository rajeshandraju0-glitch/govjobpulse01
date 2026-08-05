// Section 8: "Push notifications: OneSignal or Firebase as an optional
// provider; subscription API, device registration, admin config —
// disabled by default." This registers a device/browser endpoint;
// actual push sending still goes through PushProvider
// (packages/notifications), which — same as Email — has no real
// subscriber list to iterate yet beyond a single test token. This
// endpoint is what Phase 12+ wiring would query to get that real list.

import { NextResponse } from "next/server";
import { prisma, PushPlatform } from "@govjobpulse/database";

const VALID_PLATFORMS = new Set(["WEB", "IOS", "ANDROID"]);

export async function POST(request: Request): Promise<NextResponse> {
  let body: { endpoint?: string; platform?: string };
  try {
    body = (await request.json()) as { endpoint?: string; platform?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const endpoint = body.endpoint?.trim();
  const platform = body.platform?.trim().toUpperCase();

  if (!endpoint) {
    return NextResponse.json({ error: "endpoint is required" }, { status: 400 });
  }
  if (!platform || !VALID_PLATFORMS.has(platform)) {
    return NextResponse.json({ error: "platform must be one of WEB, IOS, ANDROID" }, { status: 400 });
  }

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
