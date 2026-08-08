import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { logout } from "./login/actions";
import "./globals.css";

export const metadata: Metadata = {
  title: "GovJobPulse Admin",
  description: "Internal operations console — not part of the public site.",
  robots: { index: false, follow: false },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Reads the identity middleware.ts already verified — the login
  // page itself has no session yet, so this is simply absent there
  // (middleware exempts /login from the auth check), and the nav
  // below degrades gracefully rather than needing a separate branch.
  const headersList = await headers();
  const userEmail = headersList.get("x-govjobpulse-user-email");

  return (
    <html lang="en">
      <body>
        <div className="shell">
          <header className="shell-header">
            <span className="shell-brand">GovJobPulse</span>
            <span className="shell-brand-sub">Admin</span>
            {userEmail && (
              <nav className="shell-nav">
                <Link href="/moderation">Moderation</Link>
                <Link href="/sources">Sources</Link>
                <Link href="/integrations">Social Integrations</Link>
                <Link href="/analytics">Analytics</Link>
                <span style={{ color: "var(--text-dim)" }}>{userEmail}</span>
                <form action={logout} style={{ display: "inline" }}>
                  <button type="submit" style={{ background: "none", border: "none", color: "var(--text-dim)", cursor: "pointer", padding: 0, font: "inherit" }}>
                    Sign out
                  </button>
                </form>
              </nav>
            )}
          </header>
          <main className="shell-main">{children}</main>
        </div>
      </body>
    </html>
  );
}
