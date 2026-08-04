interface HeroProps {
  totalPublishedJobs: number;
}

// Section 1 rule 2: never fabricate live-looking data. The count below
// is a real prop passed from a Prisma query in app/page.tsx
// (prisma.job.count({ status: PUBLISHED })) — not a hardcoded number.
// If that query hasn't run yet (e.g. in a preview build with no data),
// this renders honestly as zero rather than a made-up placeholder.
export function Hero({ totalPublishedJobs }: HeroProps) {
  return (
    <section className="hero-mesh relative overflow-hidden px-4 py-20 text-white">
      <div className="mx-auto max-w-3xl text-center">
        <h1 className="font-display text-4xl font-bold tracking-tight sm:text-5xl">
          Every Sarkari Naukri notification, verified.
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-base text-white/70 sm:text-lg">
          GovJobPulse tracks official government sources and brings you every recruitment
          notification, admit card, result and answer key the moment it&apos;s released — organised
          and built for students who can&apos;t afford to miss a deadline.
        </p>
        <form action="/search" method="get" className="mx-auto mt-8 flex max-w-md items-center gap-2 rounded-full bg-white/10 p-1.5 backdrop-blur-sm">
          <input
            type="search"
            name="q"
            placeholder="Search by post, department, or exam..."
            className="w-full rounded-full bg-transparent px-4 py-2 text-sm text-white placeholder:text-white/50 focus:outline-none"
            aria-label="Search jobs"
          />
          <button
            type="submit"
            className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary/90"
          >
            Search
          </button>
        </form>
        <p className="mt-6 font-data text-sm text-white/50">
          {totalPublishedJobs.toLocaleString("en-IN")} verified openings currently live · All
          states covered
        </p>
      </div>
    </section>
  );
}
