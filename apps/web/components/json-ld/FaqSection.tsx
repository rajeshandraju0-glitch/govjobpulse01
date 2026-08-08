// Section 6: "JSON-LD: ... FAQ schema ..." Real, honest answers matching
// what the product actually does at this phase — no promising features
// that aren't built yet (e.g. push/email notifications are still
// disabled placeholders per Section 7/8, so the FAQ doesn't claim
// GovJobPulse will notify you).

import { safeJsonLdStringify } from "@/lib/site";

const FAQS = [
  {
    question: "What is Sarkari Naukri?",
    answer:
      "Sarkari Naukri means a government job in India — roles across central government departments, state governments, public sector undertakings (PSUs), banks, railways, teaching, police, and defence.",
  },
  {
    question: "How does GovJobPulse verify job listings?",
    answer:
      "Every listing is sourced directly from an official government website or notification and links back to that original source. Look for the verified badge on each listing — it links straight to the official notice so you can confirm every detail yourself before applying.",
  },
  {
    question: "Can I apply for a job directly through GovJobPulse?",
    answer:
      "No — GovJobPulse aggregates and organises official notifications, but applications always happen on the hiring organisation's own portal. Use the official links on each listing to apply.",
  },
  {
    question: "How often is GovJobPulse updated?",
    answer:
      "Sources are checked automatically on a recurring schedule, and new notifications go through a review step before publishing, so listings are accurate rather than just fast.",
  },
];

export function FaqSection() {
  return (
    <section className="mx-auto max-w-3xl px-4 py-12">
      <h2 className="font-display text-2xl font-semibold text-secondary">Frequently asked questions</h2>
      <dl className="mt-6 space-y-6">
        {FAQS.map((faq) => (
          <div key={faq.question}>
            <dt className="font-semibold text-secondary">{faq.question}</dt>
            <dd className="mt-1 text-sm text-secondary/70">{faq.answer}</dd>
          </div>
        ))}
      </dl>
      <FaqJsonLd />
    </section>
  );
}

function FaqJsonLd() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQS.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    })),
  };

  return (
    <script
      type="application/ld+json"
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: safeJsonLdStringify(jsonLd) }}
    />
  );
}
