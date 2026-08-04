export function Footer() {
  return (
    <footer className="mt-16 border-t border-secondary/10 bg-secondary/[0.02] py-10">
      <div className="mx-auto max-w-6xl px-4 text-sm text-secondary/60">
        <p className="font-display font-semibold text-secondary">GovJobPulse</p>
        <p className="mt-2 max-w-xl">
          GovJobPulse aggregates recruitment notifications, admit cards, results, answer keys, and
          syllabus updates from official government sources only, and publishes them as verified,
          organised listings. Every listing links back to the official notification — always
          confirm details there before applying.
        </p>
        <p className="mt-6">© {new Date().getFullYear()} GovJobPulse. All states covered.</p>
        <p className="mt-2 flex gap-4 text-xs">
          <a href="/sitemap-html" className="hover:text-primary">
            Sitemap
          </a>
          <a href="/feed.xml" className="hover:text-primary">
            RSS Feed
          </a>
        </p>
      </div>
    </footer>
  );
}
