import { NextResponse } from "next/server";

// Section 9: "/live" — Kubernetes/Docker liveness-probe convention:
// answers "is this process alive and able to respond at all", nothing
// more. Deliberately does NOT check the database — a DB outage should
// make /ready fail (take traffic away from this instance) but must
// NOT make /live fail (which would tell the orchestrator to kill and
// restart the process — restarting web won't fix a database outage,
// it'll just cause a restart loop on top of the outage).
export async function GET(): Promise<NextResponse> {
  return NextResponse.json({ status: "alive" });
}
