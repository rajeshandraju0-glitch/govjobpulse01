import { NextResponse } from "next/server";
import { prisma, SubscriberStatus } from "@govjobpulse/database";
import { isTokenExpired } from "@govjobpulse/shared";

export async function GET(request: Request): Promise<NextResponse> {
  const token = new URL(request.url).searchParams.get("token");
  if (!token) {
    return NextResponse.json({ error: "Missing token" }, { status: 400 });
  }

  const subscriber = await prisma.newsletterSubscriber.findUnique({
    where: { verificationToken: token },
  });

  if (!subscriber) {
    return NextResponse.json({ error: "Invalid or already-used verification link" }, { status: 404 });
  }

  if (isTokenExpired(subscriber.verificationTokenExpiresAt)) {
    return NextResponse.json(
      { error: "This verification link has expired. Please subscribe again." },
      { status: 410 }
    );
  }

  await prisma.newsletterSubscriber.update({
    where: { id: subscriber.id },
    data: {
      status: SubscriberStatus.VERIFIED,
      verifiedAt: new Date(),
      // Single-use: clear the token now that it's been consumed, so
      // the same link can't be replayed.
      verificationToken: null,
      verificationTokenExpiresAt: null,
    },
  });

  return NextResponse.json({ message: "Subscription confirmed." });
}
