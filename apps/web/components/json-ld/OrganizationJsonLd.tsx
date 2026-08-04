import { SITE_URL, SITE_NAME } from "@/lib/site";

// Section 6: "JSON-LD: ... Organization schema ..." This describes
// GovJobPulse itself (the publisher), not the government bodies whose
// notices it aggregates — those get their own hiringOrganization entry
// inside each JobPosting (see JobPostingJsonLd.tsx).
export function OrganizationJsonLd() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_NAME,
    url: SITE_URL,
    description:
      "GovJobPulse tracks official government sources to bring students every Sarkari Naukri notification, admit card, result and answer key the moment it's released.",
  };

  return (
    <script
      type="application/ld+json"
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}
