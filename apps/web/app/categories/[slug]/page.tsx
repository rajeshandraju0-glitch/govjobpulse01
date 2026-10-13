import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCategory, getPublishedJobs } from "@/lib/jobs";
import { JobCard } from "@/components/JobCard";
import { Pagination } from "@/components/Pagination";
import { resolvePagination } from "@/lib/pagination";
import { BreadcrumbJsonLd } from "@/components/json-ld/BreadcrumbJsonLd";
import { absoluteUrl } from "@/lib/site";

export const dynamic = "force-dynamic"; // DB query — render at request time, not build time

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const category = await getCategory(slug);
  if (!category) return {};
  const title = `${category.name} Government Jobs`;
  const description = `Verified ${category.name} government job notifications, admit cards, and results — sourced directly from official notices.`;
  return {
    title,
    description,
    alternates: { canonical: absoluteUrl(`/categories/${slug}`) },
    openGraph: { title, description, url: absoluteUrl(`/categories/${slug}`) },
  };
}

export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { slug } = await params;
  const resolvedSearchParams = await searchParams;
  const category = await getCategory(slug);
  if (!category) notFound();

  const { page, take, skip } = resolvePagination(resolvedSearchParams);
  const { jobs, total } = await getPublishedJobs({ skip, take, categorySlug: slug });

  return (
    <section className="mx-auto max-w-6xl px-4 py-12">
      <BreadcrumbJsonLd
        crumbs={[
          { name: "Home", path: "/" },
          { name: category.name, path: `/categories/${slug}` },
        ]}
      />
      <p className="text-xs font-medium uppercase tracking-wide text-primary">Category</p>
      <h1 className="mt-1 font-display text-3xl font-bold text-secondary">{category.name} Jobs</h1>
      {category.description && <p className="mt-2 max-w-2xl text-secondary/60">{category.description}</p>}

      {jobs.length === 0 ? (
        <div className="mt-8 rounded-xl border border-dashed border-secondary/20 p-10 text-center text-secondary/50">
          No published {category.name} jobs right now. Check back soon.
        </div>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {jobs.map((job) => (
            <JobCard key={job.slug} job={job} />
          ))}
        </div>
      )}

      <Pagination currentPage={page} totalItems={total} pageSize={take} basePath={`/categories/${slug}`} />
    </section>
  );
}
