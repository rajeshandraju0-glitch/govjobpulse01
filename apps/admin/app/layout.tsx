import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GovJobPulse Admin",
  description: "Internal operations console — not part of the public site.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="shell">
          <header className="shell-header">
            <span className="shell-brand">GovJobPulse</span>
            <span className="shell-brand-sub">Admin</span>
          </header>
          <main className="shell-main">{children}</main>
        </div>
      </body>
    </html>
  );
}
