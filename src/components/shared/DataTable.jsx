import { useState, useMemo } from 'react'
import { TableLoader, EmptyRow } from './Loader'

export default function DataTable({ columns, data, loading, keyField = 'id', onRowSelect, selectedIds = [], showCheckbox = false, onRowClick }) {
  const [sortKey, setSortKey] = useState(null)
  const [sortDir, setSortDir] = useState('asc')

  const handleSort = (key) => {
    if (!key) return
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  const sorted = [...(data || [])].sort((a, b) => {
    if (!sortKey) return 0
    const av = a[sortKey] ?? ''
    const bv = b[sortKey] ?? ''
    const cmp = typeof av === 'number'
      ? av - bv
      : String(av).localeCompare(String(bv))
    return sortDir === 'asc' ? cmp : -cmp
  })

  const allSelected = sorted.length > 0 && sorted.every(r => selectedIds.includes(r[keyField]))

  const handleExport = () => {
    if (!sorted.length) return
    const headers = columns.map(c => c.label).join(',')
    const rows = sorted.map(row => columns.map(c => {
      const val = row[c.key]
      if (val === null || val === undefined) return ''
      const str = String(val)
      return str.includes(',') || str.includes('"') ? `"${str.replace(/"/g, '""')}"` : str
    }).join(','))
    const csv = [headers, ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `export_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="data-table-shell">
      <div className="flex items-center justify-between gap-2 mb-3">
        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">{sorted.length} {sorted.length === 1 ? 'record' : 'records'}</span>
        <button
          onClick={handleExport}
          disabled={!sorted.length}
          aria-label="Export visible records as CSV"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
        >
          <i className="fas fa-download text-[10px]" />
          Export CSV
        </button>
      </div>
      <div className="overflow-x-auto"><table className="w-full min-w-[800px]">
        <thead>
          <tr>
            {showCheckbox && (
              <th className="table-th w-10">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={e => onRowSelect?.(e.target.checked ? sorted.map(r => r[keyField]) : [])}
                  className="rounded border-gray-300"
                />
              </th>
            )}
            {columns.map((col) => (
              <th
                key={col.key}
                className={`table-th ${col.sortable !== false ? 'hover:text-gray-700 dark:hover:text-gray-200' : ''} ${col.className || ''}`}
                onClick={() => col.sortable !== false && handleSort(col.key)}
                aria-sort={sortKey === col.key ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
              >
                <span className="flex items-center gap-1">
                  {col.label}
                  {col.sortable !== false && sortKey === col.key && (
                    <i className={`fas fa-sort-${sortDir === 'asc' ? 'up' : 'down'} text-blue-500 text-xs`} />
                  )}
                  {col.sortable !== false && sortKey !== col.key && (
                    <i className="fas fa-sort text-gray-300 text-xs" />
                  )}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <TableLoader />
          ) : sorted.length === 0 ? (
            <EmptyRow cols={columns.length + (showCheckbox ? 1 : 0)} />
          ) : sorted.map((row, idx) => (
            <tr key={row[keyField] || idx} className={`table-tr ${onRowClick ? 'cursor-pointer' : ''}`} onClick={() => onRowClick?.(row)} tabIndex={onRowClick ? 0 : undefined} onKeyDown={e => { if (onRowClick && (e.key === 'Enter' || e.key === ' ')) onRowClick(row) }}>
              {showCheckbox && (
                <td className="table-td">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(row[keyField])}
                    onChange={e => {
                      const next = e.target.checked
                        ? [...selectedIds, row[keyField]]
                        : selectedIds.filter(id => id !== row[keyField])
                      onRowSelect?.(next)
                    }}
                    className="rounded border-gray-300"
                  />
                </td>
              )}
              {columns.map((col) => (
                <td key={col.key} className={`table-td ${col.tdClassName || ''}`}>
                  {col.render ? col.render(row[col.key], row, idx) : row[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table></div>
    </div>
  )
}
