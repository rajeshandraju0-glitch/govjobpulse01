import { login } from "./actions";
import { redirect } from "next/navigation";

export const metadata = { title: "Login — GovJobPulse Admin" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error: queryError } = await searchParams;

  async function handleLogin(formData: FormData) {
    "use server";
    const result = await login(formData);
    // login() redirects on success (throws internally), so reaching
    // this line means it returned an error.
    if (result?.error) {
      redirect(`/login?error=${encodeURIComponent(result.error)}`);
    }
  }

  return (
    <div style={{ maxWidth: "360px", margin: "4rem auto" }}>
      <h1 style={{ marginBottom: "0.25rem" }}>GovJobPulse Admin</h1>
      <p className="page-subtitle" style={{ marginBottom: "1.5rem" }}>
        Sign in to continue.
      </p>

      {queryError && (
        <p style={{ color: "var(--stale)", fontSize: "0.85rem", marginBottom: "1rem" }}>{queryError}</p>
      )}

      <form action={handleLogin} style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        <input
          type="email"
          name="email"
          placeholder="Email"
          required
          autoComplete="username"
          style={{
            padding: "0.6rem 0.8rem",
            borderRadius: "6px",
            border: "1px solid var(--surface-border)",
            background: "var(--surface)",
            color: "var(--text)",
          }}
        />
        <input
          type="password"
          name="password"
          placeholder="Password"
          required
          autoComplete="current-password"
          style={{
            padding: "0.6rem 0.8rem",
            borderRadius: "6px",
            border: "1px solid var(--surface-border)",
            background: "var(--surface)",
            color: "var(--text)",
          }}
        />
        <button
          type="submit"
          className="status-pill status-fresh"
          style={{ padding: "0.6rem 0.8rem", justifyContent: "center" }}
        >
          Sign in
        </button>
      </form>
    </div>
  );
}
