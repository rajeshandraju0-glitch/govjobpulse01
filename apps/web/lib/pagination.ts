// Section 10: "pagination throughout (never unbounded queries on list
// endpoints — add a hard max page size)." Every list query on the
// public site goes through this so the cap lives in one place.

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 50;

export interface PaginationParams {
  page: number;
  take: number;
  skip: number;
}

export function resolvePagination(searchParams: {
  page?: string;
}): PaginationParams {
  const rawPage = Number(searchParams.page);
  const page = Number.isFinite(rawPage) && rawPage > 0 ? Math.floor(rawPage) : 1;
  const take = DEFAULT_PAGE_SIZE;
  return { page, take, skip: (page - 1) * take };
}

export function clampPageSize(requested: number): number {
  return Math.max(1, Math.min(requested, MAX_PAGE_SIZE));
}
