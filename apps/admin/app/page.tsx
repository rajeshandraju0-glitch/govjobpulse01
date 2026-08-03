import { redirect } from "next/navigation";

// TODO(Phase 9): a real landing page once there's more than one admin
// screen (job moderation queue, Social Integrations panel, ...). For
// now /sources (Phase 4's staleness view) is the only screen, so the
// root just redirects there.
export default function AdminHome() {
  redirect("/sources");
}
