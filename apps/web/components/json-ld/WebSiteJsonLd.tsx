import { SITE_URL, SITE_NAME, safeJsonLdStringify } from "@/lib/site";

// Section 6: "JSON-LD: ... SearchAction schema." This must point at
// genuinely working search functionality — structured data that
// advertises a capability the site doesn't actually have is the same
// "fabrication" problem Section 1 rule 2 warns about, just expressed as
// markup instead of UI copy. app/search/page.tsx implements the target
// URL pattern for real.
export function WebSiteJsonLd() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: SITE_URL,
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${SITE_URL}/search?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };

  return (
    <script
      type="application/ld+json"
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: safeJsonLdStringify(jsonLd) }}
    />
  );
}
