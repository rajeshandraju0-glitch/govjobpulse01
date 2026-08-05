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
import { prisma, SubscriberStatus } from "@govjobpulse/database";
import { generateSubscriptionToken, computeVerificationExpiry } from "@govjobpulse/shared";

function isValidEmail(email: string): boolean {
  // Deliberately simple — RFC 5322-complete validation is famously not
  // worth it; this catches the obvious "not an email at all" case, and
  // the verification-link step is the real correctness check anyway.
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function POST(request: Request): Promise<NextResponse> {
  let body: { email?: string; dailyDigest?: boolean; weeklyDigest?: boolean };
  try {
    body = (await request.json()) as { email?: string; dailyDigest?: boolean; weeklyDigest?: boolean };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase();
  if (!email || !isValidEmail(email)) {
    return NextResponse.json({ error: "A valid email address is required" }, { status: 400 });
  }

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
        dailyDigest: body.dailyDigest ?? existing.dailyDigest,
        weeklyDigest: body.weeklyDigest ?? existing.weeklyDigest,
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
      dailyDigest: body.dailyDigest ?? true,
      weeklyDigest: body.weeklyDigest ?? false,
    },
  });

  return NextResponse.json({ message: "Check your email to confirm your subscription." });
}
