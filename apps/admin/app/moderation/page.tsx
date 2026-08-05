import { prisma, JobStatus } from "@govjobpulse/database";
import { markReviewed, publishJob } from "./actions";

export const metadata = { title: "Job Moderation — GovJobPulse Admin" };
export const dynamic = "force-dynamic";

export default async function ModerationPage() {
  const [drafts, reviewed] = await Promise.all([
    prisma.job.findMany({
      where: { status: JobStatus.DRAFT },
      include: { organization: true, category: true },
      orderBy: { createdAt: "desc" },
      take: 50, // Section 10: bounded, not unbounded
    }),
    prisma.job.findMany({
      where: { status: JobStatus.REVIEWED },
      include: { organization: true, category: true },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  ]);

  return (
    <div>
      <h1>Job Moderation</h1>
      <p className="page-subtitle">
        Section 4&apos;s moderation gate: scraped jobs enter as draft and only reach the public site
        once promoted through here — draft → reviewed → published.
      </p>

      <ModerationSection
        title={`Draft (${drafts.length})`}
        subtitle="Freshly scraped, not yet reviewed by a human."
        jobs={drafts}
        action={markReviewed}
        actionLabel="Mark reviewed"
      />

      <div style={{ marginTop: "2.5rem" }}>
        <ModerationSection
          title={`Reviewed (${reviewed.length})`}
          subtitle="Reviewed and ready to go live. Publishing triggers the JobPublished event and enqueues a notification."
          jobs={reviewed}
          action={publishJob}
          actionLabel="Publish"
        />
      </div>
    </div>
  );
}

interface JobRow {
  id: string;
  title: string;
  slug: string;
  advertisementNumber: string | null;
  officialNotificationUrl: string;
  organization: { name: string };
  category: { name: string };
}

function ModerationSection({
  title,
  subtitle,
  jobs,
  action,
  actionLabel,
}: {
  title: string;
  subtitle: string;
  jobs: JobRow[];
  action: (jobId: string) => Promise<void>;
  actionLabel: string;
}) {
  return (
    <section>
      <h2 style={{ fontSize: "1.05rem", fontWeight: 600, margin: "0 0 0.25rem" }}>{title}</h2>
      <p className="page-subtitle" style={{ marginBottom: "0.75rem" }}>
        {subtitle}
      </p>

      {jobs.length === 0 ? (
        <div className="empty-state">Nothing here right now.</div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Title</th>
              <th>Organization</th>
              <th>Category</th>
              <th>Ref</th>
              <th>Source</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((job) => (
              <tr key={job.id}>
                <td>{job.title}</td>
                <td>{job.organization.name}</td>
                <td>{job.category.name}</td>
                <td className="mono">{job.advertisementNumber ?? "—"}</td>
                <td>
                  <a
                    href={job.officialNotificationUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="status-pill status-fresh"
                  >
                    Source ↗
                  </a>
                </td>
                <td>
                  <form
                    action={async () => {
                      "use server";
                      await action(job.id);
                    }}
                  >
                    <button type="submit" className="status-pill status-warning">
                      {actionLabel}
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
