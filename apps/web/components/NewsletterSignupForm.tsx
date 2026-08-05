"use client";

import { useState, type ChangeEvent, type FormEvent } from "react";

// Section 8's subscription API needs to be reachable from somewhere,
// not just exist as a backend route nobody calls — this is that
// minimal surface. Keeping it as a small, isolated client component
// (apps/web's first) rather than converting a larger page to a client
// component, since everything else stays server-rendered.
export function NewsletterSignupForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setStatus("loading");
    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = (await res.json()) as { message?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Something went wrong");
      setMessage(data.message ?? "Subscribed.");
      setStatus("done");
    } catch (err) {
      setMessage((err as Error).message);
      setStatus("error");
    }
  }

  if (status === "done") {
    return <p className="text-sm text-success">{message}</p>;
  }

  return (
    <form onSubmit={handleSubmit} className="flex max-w-sm gap-2">
      <input
        type="email"
        required
        value={email}
        onChange={(e: ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
        placeholder="you@example.com"
        className="w-full rounded-lg border border-secondary/15 px-3 py-2 text-sm focus:border-primary focus:outline-none"
        aria-label="Email address"
      />
      <button
        type="submit"
        disabled={status === "loading"}
        className="shrink-0 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-60"
      >
        {status === "loading" ? "..." : "Subscribe"}
      </button>
      {status === "error" && <p className="text-xs text-danger">{message}</p>}
    </form>
  );
}
