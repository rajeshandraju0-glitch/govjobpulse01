import Link from "next/link";

export function Header() {
  return (
    <header className="border-b border-secondary/10 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
        <Link href="/" className="font-display text-lg font-bold tracking-tight text-secondary">
          GovJobPulse
        </Link>
        <nav className="hidden gap-6 text-sm font-medium text-secondary/70 md:flex">
          <Link href="/categories/central" className="hover:text-primary">
            Categories
          </Link>
          <Link href="/states/all-india" className="hover:text-primary">
            States
          </Link>
          <Link href="/qualifications/graduate" className="hover:text-primary">
            Qualifications
          </Link>
        </nav>
      </div>
    </header>
  );
}
