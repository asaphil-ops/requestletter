export function Spinner({ size = 'md' }) {
  const s = { sm: 'w-4 h-4 border-2', md: 'w-8 h-8 border-2', lg: 'w-12 h-12 border-3' }[size]
  return (
    <div className={`${s} border-gray-200 dark:border-slate-700 border-t-blue-600 dark:border-t-sky-400 rounded-full animate-spin`} />
  )
}

function Shimmer({ className = '' }) {
  return (
    <div className={`relative overflow-hidden rounded-lg bg-gray-100 dark:bg-slate-800/60 ${className}`}>
      <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/40 dark:via-white/5 to-transparent" />
    </div>
  )
}

export function PageLoader({ text = 'Loading workspace...' }) {
  return (
    <div className="py-10 space-y-6">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Shimmer className="h-7 w-56" />
          <Shimmer className="h-4 w-80 max-w-full" />
        </div>
        <Shimmer className="h-10 w-28 rounded-lg" />
      </div>

      {/* Stats cards skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="bg-white dark:bg-slate-900/50 border border-gray-100 dark:border-slate-700/50 rounded-xl p-4 space-y-3 shadow-sm">
            <div className="flex items-center justify-between">
              <Shimmer className="h-3 w-20" />
              <Shimmer className="h-8 w-8 rounded-lg" />
            </div>
            <Shimmer className="h-7 w-28" />
            <Shimmer className="h-2 w-full" />
          </div>
        ))}
      </div>

      {/* Table skeleton */}
      <div className="bg-white dark:bg-slate-900/50 border border-gray-100 dark:border-slate-700/50 rounded-xl overflow-hidden shadow-sm">
        <TableSkeleton rows={8} cols={6} />
      </div>

      <div className="sr-only">{text}</div>
    </div>
  )
}

function TableSkeleton({ rows = 8, cols = 6 }) {
  return (
    <div className="p-4 space-y-3">
      {/* Header row */}
      <div className="grid gap-3 mb-4" style={{ gridTemplateColumns: `repeat(${cols}, minmax(84px, 1fr))` }}>
        {Array.from({ length: cols }).map((_, i) => (
          <Shimmer key={i} className="h-3 rounded" />
        ))}
      </div>
      {/* Data rows */}
      {Array.from({ length: rows }).map((_, row) => (
        <div key={row} className="grid gap-3 rounded-lg bg-gray-50/50 dark:bg-slate-800/30 p-3"
          style={{ gridTemplateColumns: `repeat(${cols}, minmax(84px, 1fr))` }}>
          {Array.from({ length: cols }).map((_, col) => (
            <Shimmer key={col} className={`h-4 ${col === 0 ? 'w-12' : col === 2 ? 'w-3/4' : 'w-full'}`} />
          ))}
        </div>
      ))}
    </div>
  )
}

export function TableLoader({ rows = 8, cols = 6 }) {
  return (
    <tr>
      <td colSpan={20} className="table-td p-0">
        <TableSkeleton rows={rows} cols={cols} />
      </td>
    </tr>
  )
}

export function EmptyRow({ cols = 10, message = 'No data found' }) {
  return (
    <tr>
      <td colSpan={cols} className="table-td text-center py-16 text-gray-400 dark:text-slate-400 text-sm">
        <div className="flex flex-col items-center gap-3">
          <div className="w-14 h-14 rounded-xl bg-gray-50 dark:bg-slate-800/60 border border-gray-100 dark:border-slate-700/50 flex items-center justify-center">
            <i className="fas fa-inbox text-xl text-gray-300 dark:text-slate-500" />
          </div>
          <div>
            <p className="font-medium text-gray-500 dark:text-slate-400">{message}</p>
            <p className="text-xs text-gray-300 dark:text-slate-600 mt-0.5">No records to display</p>
          </div>
        </div>
      </td>
    </tr>
  )
}