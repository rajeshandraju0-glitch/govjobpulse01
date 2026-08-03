// Section 0.1's signature visual language, and Section 1 rule 2's
// concrete positive example: "verified-source badges, not fabricated
// 'live' counters." This component is the one thing every job card and
// detail page uses to make the trust claim real — it always links to
// the actual officialNotificationUrl, never a generic "verified" label
// with nothing behind it.

interface VerifiedSourceBadgeProps {
  officialNotificationUrl: string;
  sourceName?: string;
}

export function VerifiedSourceBadge({ officialNotificationUrl, sourceName }: VerifiedSourceBadgeProps) {
  return (
    <a
      href={officialNotificationUrl}
      target="_blank"
      rel="noopener noreferrer nofollow"
      className="inline-flex items-center gap-1.5 rounded-full border border-success/30 bg-success/10 px-2.5 py-1 text-xs font-medium text-success transition-colors hover:bg-success/20"
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      Verified against official notice{sourceName ? ` — ${sourceName}` : ""}
    </a>
  );
}
