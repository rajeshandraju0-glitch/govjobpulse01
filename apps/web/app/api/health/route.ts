import { NextResponse } from "next/server";
import { checkDatabaseHealth } from "@govjobpulse/database";

// Section 9: "/health" — a human-friendly combined view (distinct from
// /live and /ready, which are specifically shaped for orchestrator
// probes). Useful for a person checking status directly, or for
// monitoring dashboards that want one endpoint rather than two.
export async function GET(): Promise<NextResponse> {
  const db = await checkDatabaseHealth();
  return NextResponse.json({
    status: db.healthy ? "healthy" : "unhealthy",
    timestamp: new Date().toISOString(),
    checks: { database: db },
  });
}
