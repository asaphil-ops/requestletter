export default function Pagination({ page, total, rowsPerPage = 50, onChange, info }) {
  const totalPages = Math.ceil(total / rowsPerPage)
  const start = (page - 1) * rowsPerPage + 1
  const end = Math.min(start + rowsPerPage - 1, total)

  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 rounded-b-xl flex-wrap gap-2">
      <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">
        {total > 0 ? `Showing ${start}-${end} of ${total}` : 'No records'}
      </span>
      <div className="flex items-center gap-2">
        {info}
        <button
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
          className="btn-secondary text-xs px-3 py-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Prev
        </button>
        <span className="text-xs text-gray-500 dark:text-gray-400 font-medium px-1">
          {page} / {totalPages || 1}
        </span>
        <button
          disabled={end >= total}
          onClick={() => onChange(page + 1)}
          className="btn-secondary text-xs px-3 py-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Next
        </button>
      </div>
    </div>
  )
}
