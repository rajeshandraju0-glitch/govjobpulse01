import { ImageResponse } from "next/og";
import { getJobBySlug } from "@/lib/jobs";

// Section 6: "auto-generated branded OG images per job (title,
// organization, last date, vacancies, GovJobPulse branding) —
// architect this so branded images can be added later without changing
// routes." Using Next's file-convention (opengraph-image.tsx) IS that
// architecture: the route itself doesn't change, this file just starts
// existing. Uses system-ui rather than a custom font file — ImageResponse
// needs fonts fetched as raw bytes, and fetching one from Google Fonts
// or elsewhere at request time would hit the same network restriction
// this sandbox already has for next/font/google (see CLAUDE.md). A
// custom branded font can be added later by fetching font bytes from
// this repo's own /public directory (bundled, not network-fetched) —
// noted here rather than done now since no font files are bundled yet.

export const runtime = "edge";
export const alt = "GovJobPulse job notification";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpengraphImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const job = await getJobBySlug(slug);

  const title = job?.title ?? "Job Notification";
  const organization = job?.organization.name ?? "GovJobPulse";
  const vacancies = job?.vacancies;
  const lastDate = job?.applicationEnd
    ? new Date(job.applicationEnd).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : null;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "64px",
          background: "linear-gradient(135deg, #0F172A 0%, #1e1b4b 50%, #0F172A 100%)",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 12,
              height: 12,
              borderRadius: 999,
              background: "#16A34A",
            }}
          />
          <span style={{ color: "#fff", fontSize: 28, fontWeight: 700 }}>GovJobPulse</span>
          <span style={{ color: "rgba(255,255,255,0.5)", fontSize: 20 }}>Verified</span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <span style={{ color: "#F59E0B", fontSize: 22, fontWeight: 600 }}>{organization}</span>
          <span
            style={{
              color: "#fff",
              fontSize: 48,
              fontWeight: 700,
              lineHeight: 1.15,
              display: "-webkit-box",
              WebkitLineClamp: 3,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {title}
          </span>
        </div>

        <div style={{ display: "flex", gap: 32, color: "rgba(255,255,255,0.85)", fontSize: 24 }}>
          {vacancies !== null && vacancies !== undefined && (
            <span>{vacancies.toLocaleString("en-IN")} vacancies</span>
          )}
          {lastDate && <span>Last date: {lastDate}</span>}
        </div>
      </div>
    ),
    { ...size }
  );
}
