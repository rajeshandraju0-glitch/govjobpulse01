"use client";

import { useState } from "react";
import { buildShareLinks } from "@govjobpulse/shared";

interface SocialShareButtonsProps {
  url: string;
  title: string;
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
export function SocialShareButtons({ url, title }: SocialShareButtonsProps) {
  const [copied, setCopied] = useState(false);
  const links = buildShareLinks(url, title);

  async function handleCopyLink() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API can fail (permissions, non-HTTPS context, older
      // browsers) — fail quietly rather than throw an unhandled error
      // over what's a minor convenience feature, not core functionality.
    }
  }

  const shareTargets: { key: keyof typeof links; label: string }[] = [
    { key: "facebook", label: "Facebook" },
    { key: "linkedin", label: "LinkedIn" },
    { key: "twitter", label: "X" },
    { key: "telegram", label: "Telegram" },
    { key: "whatsapp", label: "WhatsApp" },
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
