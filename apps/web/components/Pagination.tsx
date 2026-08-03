interface PaginationProps {
  currentPage: number;
  totalItems: number;
  pageSize: number;
  basePath: string;
}

export function Pagination({ currentPage, totalItems, pageSize, basePath }: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  if (totalPages <= 1) return null;

  const hasPrev = currentPage > 1;
  const hasNext = currentPage < totalPages;

  return (
    <nav className="mt-8 flex items-center justify-between text-sm" aria-label="Pagination">
      {hasPrev ? (
        <a href={`${basePath}?page=${currentPage - 1}`} className="font-medium text-primary hover:underline">
          ← Previous
        </a>
      ) : (
        <span />
      )}
      <span className="font-data text-secondary/50">
        Page {currentPage} of {totalPages}
      </span>
      {hasNext ? (
        <a href={`${basePath}?page=${currentPage + 1}`} className="font-medium text-primary hover:underline">
          Next →
        </a>
      ) : (
        <span />
      )}
    </nav>
  );
}
