import { absoluteUrl } from "@/lib/site";

// Section 6: "JSON-LD: JobPosting schema..." Only real, known fields are
// populated — per Section 1 rule 2 (never fabricate data), fields the
// scraper/reviewer didn't fill in are simply omitted from the schema
// rather than backfilled with a plausible-looking guess. Google's
// structured-data guidelines for JobPosting also penalize
// spec/guideline violations (missing required fields, stale postings
// left published without validThrough), so accuracy here isn't just an
// internal principle, it affects search eligibility too.

interface JobPostingJsonLdProps {
  job: {
    slug: string;
    title: string;
    description: string;
    createdAt: Date;
    applicationEnd: Date | null;
    officialWebsite: string;
    department: string;
    salary: string | null;
    jobType: string;
    organization: { name: string };
    states: { state: { name: string } }[];
  };
}

const EMPLOYMENT_TYPE_MAP: Record<string, string> = {
  FULL_TIME: "FULL_TIME",
  PART_TIME: "PART_TIME",
  CONTRACT: "CONTRACTOR",
  APPRENTICESHIP: "OTHER",
  INTERNSHIP: "INTERN",
};

export function JobPostingJsonLd({ job }: JobPostingJsonLdProps) {
  const jsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "JobPosting",
    title: job.title,
    description: job.description,
    datePosted: job.createdAt.toISOString(),
    hiringOrganization: {
      "@type": "Organization",
      name: job.organization.name,
      sameAs: job.officialWebsite,
    },
    employmentType: EMPLOYMENT_TYPE_MAP[job.jobType] ?? "OTHER",
    url: absoluteUrl(`/jobs/${job.slug}`),
    identifier: {
      "@type": "PropertyValue",
      name: job.organization.name,
      value: job.slug,
    },
  };

  // validThrough: Google requires this for a posting to stay eligible in
  // Job Search results — but we only set it when we actually know the
  // real applicationEnd. An unknown date is omitted, not guessed.
  if (job.applicationEnd) {
    jsonLd.validThrough = job.applicationEnd.toISOString();
  }

  if (job.salary) {
    // salary is a free-text field on Job (pay scales vary too much to
    // model structurally per-source) — schema.org wants baseSalary as
    // structured data, which we genuinely don't have. Omit rather than
    // force free text into a numeric schema field.
  }

  if (job.states.length > 0) {
    jsonLd.jobLocation = job.states.map((js) => ({
      "@type": "Place",
      address: {
        "@type": "PostalAddress",
        addressRegion: js.state.name,
        addressCountry: "IN",
      },
    }));
  } else {
    // No state association recorded — still valid schema, just no
    // jobLocation. Do NOT default to "All India" here unless the job
    // actually has that State row associated (lib/jobs.ts already
    // includes states, so this only omits when genuinely empty).
  }

  return (
    <script
      type="application/ld+json"
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}
