import { useState } from 'react'
import { TableLoader, EmptyRow } from './Loader'

export default function DataTable({ columns, data, loading, keyField = 'id', onRowSelect, selectedIds = [], showCheckbox = false }) {
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

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[800px]">
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
            <tr key={row[keyField] || idx} className="table-tr">
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
      </table>
    </div>
  )
}
