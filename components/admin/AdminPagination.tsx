import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

export function AdminPagination({
  page,
  totalPages,
  label,
  hrefFor,
}: {
  page: number;
  totalPages: number;
  label?: string;
  hrefFor: (page: number) => string;
}) {
  const previous = page > 1 ? Math.min(page - 1, totalPages) : null;
  const next = page < totalPages ? page + 1 : null;

  return (
    <nav className="hub-pagination admin-pagination" aria-label="Pages">
      <span>Page {page} of {totalPages}{label ? ` · ${label}` : ""}</span>
      <div>
        {previous ? (
          <Link className="hub-button hub-button-outline" href={hrefFor(previous)} scroll={false}><ChevronLeft size={14} aria-hidden />Previous</Link>
        ) : (
          <span className="hub-button hub-button-outline" aria-disabled="true"><ChevronLeft size={14} aria-hidden />Previous</span>
        )}
        {next ? (
          <Link className="hub-button hub-button-outline" href={hrefFor(next)} scroll={false}>Next<ChevronRight size={14} aria-hidden /></Link>
        ) : (
          <span className="hub-button hub-button-outline" aria-disabled="true">Next<ChevronRight size={14} aria-hidden /></span>
        )}
      </div>
    </nav>
  );
}
