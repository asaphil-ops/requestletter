import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { fmtDate, ROWS_PER_PAGE } from '../lib/utils'
import Pagination from '../components/shared/Pagination'
import { TableLoader, EmptyRow } from '../components/shared/Loader'

export default function AuditLogs() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['audit_logs'],
    queryFn: async () => {
      const { data, error } = await supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(500)
      if (error) throw error
      return data || []
    },
    staleTime: 30000,
  })

  const filtered = logs.filter(l =>
    (l.user_name + l.action + l.details).toLowerCase().includes(search.toLowerCase())
  )
  const paged = filtered.slice((page - 1) * ROWS_PER_PAGE, page * ROWS_PER_PAGE)

  const actionColor = (action = '') => {
    if (action.includes('DELETE') || action.includes('REJECT')) return 'bg-red-50 text-red-600'
    if (action.includes('APPROVE') || action.includes('UPLOAD')) return 'bg-emerald-50 text-emerald-600'
    if (action.includes('CHECK')) return 'bg-blue-50 text-blue-600'
    if (action.includes('EMAIL')) return 'bg-purple-50 text-purple-600'
    if (action.includes('CREATE') || action.includes('ADD')) return 'bg-amber-50 text-amber-600'
    return 'bg-gray-50 text-gray-500'
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900 dark:text-gray-100">Audit Logs</h1>
          <p className="text-sm font-semibold text-gray-500">System activity history · last 500 entries</p>
        </div>
      </div>

      <div className="card p-3 mb-4">
        <div className="relative">
          <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
          <input className="input pl-9 text-sm" placeholder="Search by user, action, details..." value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} />
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto overflow-y-auto max-h-[70vh]">
          <table className="w-full min-w-[600px]">
            <thead className="sticky top-0 z-20 bg-white dark:bg-slate-900 shadow-sm">
              <tr>
                <th className="table-th">Date & Time</th>
                <th className="table-th">User</th>
                <th className="table-th">Action</th>
                <th className="table-th">Details</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? <TableLoader /> : paged.length === 0 ? <EmptyRow cols={4} /> :
                paged.map((l, idx) => (
                  <tr key={l.id} className="table-tr">
                    <td className="table-td text-xs text-gray-400 whitespace-nowrap">
                      {new Date(l.created_at).toLocaleString('en-PH', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="table-td font-medium text-sm">{l.user_name || '—'}</td>
                    <td className="table-td">
                      <span className={`badge text-xs ${actionColor(l.action)}`}>{l.action}</span>
                    </td>
                    <td className="table-td text-sm text-gray-500 max-w-xs truncate">{l.details || '—'}</td>
                  </tr>
                ))
              }
            </tbody>
          </table>
        </div>
        <Pagination page={page} total={filtered.length} onChange={setPage} />
      </div>
    </div>
  )
}
