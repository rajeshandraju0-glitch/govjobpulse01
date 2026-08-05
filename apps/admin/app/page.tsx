import { redirect } from "next/navigation";

// TODO(Phase 15 dev-experience pass, or whenever a 4th screen lands): a
// real landing/dashboard page once there's enough to summarize across
// screens. For now /moderation is the most actionable default — an
// admin opening this app most likely wants to know what needs review.
export default function AdminHome() {
  redirect("/moderation");
}
