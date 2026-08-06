import { NextResponse } from "next/server";
import { checkDatabaseHealth } from "@govjobpulse/database";

// Section 9: "/ready" — readiness-probe convention: "can this instance
// actually serve traffic right now." Checks the database because every
// page in apps/web reads from it — if Postgres is unreachable, this
// instance genuinely cannot serve a real request, and an orchestrator
// should stop routing traffic here (without necessarily restarting the
// process, which /live governs separately).
export async function GET(): Promise<NextResponse> {
  const db = await checkDatabaseHealth();
  return NextResponse.json({ status: db.healthy ? "ready" : "not_ready", database: db }, {
    status: db.healthy ? 200 : 503,
  });
}
