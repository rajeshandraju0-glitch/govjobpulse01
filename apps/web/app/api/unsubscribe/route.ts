import { NextResponse } from "next/server";
import { prisma, SubscriberStatus } from "@govjobpulse/database";

export async function GET(request: Request): Promise<NextResponse> {
  const token = new URL(request.url).searchParams.get("token");
  if (!token) {
    return NextResponse.json({ error: "Missing token" }, { status: 400 });
  }

  const subscriber = await prisma.newsletterSubscriber.findUnique({
    where: { unsubscribeToken: token },
  });

  if (!subscriber) {
    return NextResponse.json({ error: "Invalid unsubscribe link" }, { status: 404 });
  }

  if (subscriber.status === SubscriberStatus.UNSUBSCRIBED) {
    return NextResponse.json({ message: "Already unsubscribed." });
  }

  await prisma.newsletterSubscriber.update({
    where: { id: subscriber.id },
    data: { status: SubscriberStatus.UNSUBSCRIBED, unsubscribedAt: new Date() },
  });

  return NextResponse.json({ message: "You've been unsubscribed." });
}
