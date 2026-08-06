"use client";

import { useState } from "react";
import { buildShareLinks } from "@govjobpulse/shared";

interface SocialShareButtonsProps {
  jobId: string;
  url: string;
  title: string;
}

type ShareChannel = "FACEBOOK" | "LINKEDIN" | "TWITTER" | "TELEGRAM" | "WHATSAPP" | "COPY_LINK";

// Section 9: share-event tracking ("most shared jobs"). Uses
// navigator.sendBeacon rather than fetch() where available — clicking a
// share link immediately navigates/opens a new tab, and a beacon is
// specifically designed to survive that in a way a normal fetch()
// isn't guaranteed to (the browser can abandon in-flight requests when
// the initiating context is torn down). Falls back to a
// fire-and-forget fetch() in environments without sendBeacon.
function trackShare(jobId: string, channel: ShareChannel): void {
  const payload = JSON.stringify({ jobId, channel });
  const url = "/api/track/share";

  if (typeof navigator !== "undefined" && "sendBeacon" in navigator) {
    const blob = new Blob([payload], { type: "application/json" });
    navigator.sendBeacon(url, blob);
    return;
  }

  fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: payload, keepalive: true }).catch(
    () => {
      // Same reasoning as Copy Link's failure handling — a tracking
      // beacon failing must never surface to someone just trying to
      // share a job.
    }
  );
}

// Section 8: "every job page gets Facebook, LinkedIn, Twitter,
// Telegram, WhatsApp share buttons and Copy Link, using the Open Graph
// metadata from Section 6. This is user-initiated sharing, distinct
// from the automated posting adapters [Section 7] above, and should
// ship in this phase" — live now, not architecture-only like Phase
// 10's subscription foundations. Only "Copy Link" needs client-side
// JS (clipboard API); the platform share links are plain anchors that
// open in a new tab, but the whole thing is one client component for
// a consistent copy-feedback experience.
export function SocialShareButtons({ jobId, url, title }: SocialShareButtonsProps) {
  const [copied, setCopied] = useState(false);
  const links = buildShareLinks(url, title);

  async function handleCopyLink() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      trackShare(jobId, "COPY_LINK");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API can fail (permissions, non-HTTPS context, older
      // browsers) — fail quietly rather than throw an unhandled error
      // over what's a minor convenience feature, not core functionality.
    }
  }

  const shareTargets: { key: keyof typeof links; label: string; channel: ShareChannel }[] = [
    { key: "facebook", label: "Facebook", channel: "FACEBOOK" },
    { key: "linkedin", label: "LinkedIn", channel: "LINKEDIN" },
    { key: "twitter", label: "X", channel: "TWITTER" },
    { key: "telegram", label: "Telegram", channel: "TELEGRAM" },
    { key: "whatsapp", label: "WhatsApp", channel: "WHATSAPP" },
  ];

  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Share this job">
      <span className="text-xs font-medium text-secondary/50">Share:</span>
      {shareTargets.map((target) => (
        <a
          key={target.key}
          href={links[target.key]}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => trackShare(jobId, target.channel)}
          className="rounded-full border border-secondary/15 px-3 py-1 text-xs font-medium text-secondary/70 transition-colors hover:border-primary hover:text-primary"
        >
          {target.label}
        </a>
      ))}
      <button
        type="button"
        onClick={handleCopyLink}
        className="rounded-full border border-secondary/15 px-3 py-1 text-xs font-medium text-secondary/70 transition-colors hover:border-primary hover:text-primary"
      >
        {copied ? "Copied!" : "Copy Link"}
      </button>
    </div>
  );
}
