import { ChevronLeft, ChevronRight } from 'lucide-react'
import { pageList } from '../../lib/pagination'

/** "Showing 1–8 of 37" with previous / page numbers / next. Pages are 1-based. */
export function Pagination({
  page,
  pageSize,
  total,
  onChange,
  label = 'Pages',
}: {
  page: number
  pageSize: number
  total: number
  onChange: (page: number) => void
  label?: string
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize))
  if (total <= pageSize) return null
  const from = (page - 1) * pageSize + 1
  const to = Math.min(total, page * pageSize)
  return (
    <nav className="pagination" aria-label={label}>
      <span className="pagination__info">
        Showing {from}–{to} of {total}
      </span>
      <div className="pagination__pages">
        <button
          type="button"
          className="pagination__btn"
          aria-label="Previous page"
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
        >
          <ChevronLeft size={16} aria-hidden />
        </button>
        {pageList(page, pages).map((p, i) =>
          p === '…' ? (
            <span key={`gap-${i}`} className="pagination__gap" aria-hidden>
              …
            </span>
          ) : (
            <button
              key={p}
              type="button"
              className="pagination__btn"
              aria-label={`Page ${p}`}
              aria-current={p === page ? 'page' : undefined}
              onClick={() => onChange(p)}
            >
              {p}
            </button>
          ),
        )}
        <button
          type="button"
          className="pagination__btn"
          aria-label="Next page"
          disabled={page >= pages}
          onClick={() => onChange(page + 1)}
        >
          <ChevronRight size={16} aria-hidden />
        </button>
      </div>
    </nav>
  )
}
