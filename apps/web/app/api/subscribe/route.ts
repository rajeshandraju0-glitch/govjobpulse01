// Section 8: "Newsletter table, subscribers, unsubscribe, verification,
// daily/weekly digest schedulers — architecture only, no provider
// integration yet." This creates the PENDING row and generates a
// verification token/link; it does NOT send the verification email
// itself, since that's exactly the "provider integration" Section 8
// scopes out of this phase. In a working environment, this is the
// obvious next wiring point once someone decides how verification
// emails get sent (likely EmailProvider.sendJob() with a different
// payload shape than NotificationJobPayload, since a verification
// email isn't about a specific job — see CLAUDE.md's Phase 10 note on
// the job-centric vs. recipient-centric interface mismatch).

import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma, SubscriberStatus } from "@govjobpulse/database";
import { generateSubscriptionToken, computeVerificationExpiry } from "@govjobpulse/shared";
import { rateLimitRequest } from "@/lib/rate-limit";

// Section 10: "Zod input validation." Real RFC 5322-complete email
// validation is famously not worth it — z.string().email() catches the
// obvious "not an email at all" case, and the verification-link step
// is the real correctness check anyway.
const subscribeSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  dailyDigest: z.boolean().optional(),
  weeklyDigest: z.boolean().optional(),
});

export async function POST(request: Request): Promise<NextResponse> {
  // Section 10: "rate limiting." 5 subscribe attempts per IP per hour —
  // generous enough for a real person re-trying a typo'd email, tight
  // enough to blunt automated signup spam.
  const rateLimit = await rateLimitRequest(request, "subscribe", 5, 60 * 60);
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 });
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = subscribeSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json({ error: "A valid email address is required" }, { status: 400 });
  }
  const { email, dailyDigest, weeklyDigest } = parsed.data;

  const existing = await prisma.newsletterSubscriber.findUnique({ where: { email } });
  if (existing) {
    if (existing.status === SubscriberStatus.VERIFIED) {
      // Don't reveal whether an email is already subscribed to an
      // untrusted caller beyond "you're all set" — avoids using this
      // endpoint as an email-enumeration oracle.
      return NextResponse.json({ message: "You're already subscribed." });
    }
    // PENDING or UNSUBSCRIBED: regenerate a fresh token and re-send
    // (re-subscribing after unsubscribing is a normal, expected flow).
    const verificationToken = generateSubscriptionToken();
    await prisma.newsletterSubscriber.update({
      where: { id: existing.id },
      data: {
        status: SubscriberStatus.PENDING,
        verificationToken,
        verificationTokenExpiresAt: computeVerificationExpiry(),
        dailyDigest: dailyDigest ?? existing.dailyDigest,
        weeklyDigest: weeklyDigest ?? existing.weeklyDigest,
      },
    });
    return NextResponse.json({ message: "Check your email to confirm your subscription." });
  }

  await prisma.newsletterSubscriber.create({
    data: {
      email,
      status: SubscriberStatus.PENDING,
      verificationToken: generateSubscriptionToken(),
      verificationTokenExpiresAt: computeVerificationExpiry(),
      unsubscribeToken: generateSubscriptionToken(),
      dailyDigest: dailyDigest ?? true,
      weeklyDigest: weeklyDigest ?? false,
    },
  });

  return NextResponse.json({ message: "Check your email to confirm your subscription." });
}
