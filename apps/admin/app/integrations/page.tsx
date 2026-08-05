import { prisma } from "@govjobpulse/database";
import { toggleProviderEnabled, runProviderHealthCheck } from "./actions";

export const metadata = { title: "Social Integrations — GovJobPulse Admin" };
export const dynamic = "force-dynamic";

// Required env var presence is checked here (server-side, at render
// time) — this only ever reports true/false per var name, never the
// value itself, matching Section 1 rule 7 ("no secrets hardcoded
// anywhere") and the general principle that admin UIs shouldn't
// surface secret values even to authenticated admins unnecessarily.
function isVarPresent(varName: string): boolean {
  return Boolean(process.env[varName]);
}

export default async function IntegrationsPage() {
  const configs = await prisma.notificationProviderConfig.findMany({
    orderBy: { platform: "asc" },
  });

  return (
    <div>
      <h1>Social Integrations</h1>
      <p className="page-subtitle">
        Enable/disable each notification platform. A platform only actually sends once its
        required environment variables are set <em>and</em> it&apos;s enabled here — flipping this
        toggle alone does nothing if credentials aren&apos;t configured.
      </p>

      {configs.length === 0 ? (
        <div className="empty-state">
          No provider configs found. Run <code>pnpm --filter @govjobpulse/database db:seed</code>{" "}
          first.
        </div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Platform</th>
              <th>Credentials</th>
              <th>Enabled</th>
              <th>Last health check</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {configs.map((config) => {
              const presentCount = config.requiredEnvVars.filter(isVarPresent).length;
              const allPresent = presentCount === config.requiredEnvVars.length;
              const slug = config.platform.toLowerCase();

              return (
                <tr key={config.id}>
                  <td>{config.platform}</td>
                  <td className="mono">
                    <span className={allPresent ? "status-pill status-fresh" : "status-pill status-warning"}>
                      {presentCount}/{config.requiredEnvVars.length} vars set
                    </span>
                  </td>
                  <td>
                    <form
                      action={async () => {
                        "use server";
                        await toggleProviderEnabled(config.platform, !config.enabled);
                      }}
                    >
                      <button
                        type="submit"
                        className={`status-pill ${config.enabled ? "status-fresh" : "status-never_run"}`}
                        disabled={!allPresent && !config.enabled}
                        title={
                          !allPresent && !config.enabled
                            ? "Set all required environment variables before enabling"
                            : undefined
                        }
                      >
                        {config.enabled ? "Enabled" : "Disabled"}
                      </button>
                    </form>
                  </td>
                  <td className="mono">
                    {config.lastHealthCheckAt ? (
                      <span className={config.lastHealthCheckHealthy ? "status-pill status-fresh" : "status-pill status-stale"}>
                        {config.lastHealthCheckHealthy ? "Healthy" : "Unhealthy"} —{" "}
                        {new Date(config.lastHealthCheckAt).toLocaleString("en-IN")}
                      </span>
                    ) : (
                      <span className="status-pill status-never_run">Never checked</span>
                    )}
                    {config.lastHealthCheckDetail && (
                      <div style={{ marginTop: "0.35rem", color: "var(--text-dim)", fontSize: "0.75rem" }}>
                        {config.lastHealthCheckDetail}
                      </div>
                    )}
                  </td>
                  <td>
                    <form
                      action={async () => {
                        "use server";
                        await runProviderHealthCheck(slug);
                      }}
                    >
                      <button type="submit" className="status-pill status-never_run">
                        Test connection
                      </button>
                    </form>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
