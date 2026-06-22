import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useActionCenter } from '../hooks/useActionCenter'
import { fmtCurrency, fmtDate } from '../lib/utils'
import { downloadCsv, makeModuleFilterUrl, WORKFLOW_MODULES } from '../lib/workflow'
import { PageLoader } from '../components/shared/Loader'

export default function ActionCenter() {
  const navigate = useNavigate()
  const { data: items = [], isLoading } = useActionCenter()
  const [moduleFilter, setModuleFilter] = useState('')
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return items.filter(item => {
      if (moduleFilter && item._module !== moduleFilter) return false
      if (!needle) return true
      return `${item._moduleLabel} ${item._recordId} ${item._title} ${item._owner}`.toLowerCase().includes(needle)
    })
  }, [items, moduleFilter, search])

  if (isLoading) return <PageLoader text="Loading action center..." />

  const exportTasks = () => {
    downloadCsv(
      `pending_action_center_${new Date().toISOString().split('T')[0]}.csv`,
      ['Module', 'Reference', 'Title', 'Owner', 'Amount', 'Date Uploaded'],
      filtered.map(item => [
        item._moduleLabel,
        item._recordId,
        item._title,
        item._owner,
        item._amount,
        item.created_at || '',
      ])
    )
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-sky-600 dark:text-sky-300">My Tasks</p>
          <h1 className="text-2xl font-extrabold text-gray-900 dark:text-gray-100">Action Center</h1>
          <p className="text-sm font-semibold text-gray-500 dark:text-slate-400">{items.length} pending item{items.length !== 1 ? 's' : ''} across workflow modules</p>
        </div>
        <button
          onClick={exportTasks}
          className="btn-secondary text-xs"
        >
          <i className="fas fa-file-excel mr-1 text-green-600" />Export
        </button>
      </div>

      <div className="card relative z-30 mb-4 overflow-visible p-4">
        <div className="flex flex-wrap gap-2">
          <div className="relative min-w-[220px] flex-1">
            <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400" />
            <input
              className="input pl-9 text-sm"
              placeholder="Search pending tasks..."
              value={search}
              onChange={event => setSearch(event.target.value)}
            />
          </div>
          <select className="input w-auto text-sm" value={moduleFilter} onChange={event => setModuleFilter(event.target.value)}>
            <option value="">All Modules</option>
            {Object.values(WORKFLOW_MODULES).map(module => (
              <option key={module.key} value={module.key}>{module.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-3">
        {filtered.length === 0 ? (
          <div className="card p-10 text-center">
            <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-xl bg-emerald-50 text-emerald-600">
              <i className="fas fa-check-double" />
            </div>
            <div className="font-bold text-gray-900 dark:text-gray-100">No pending tasks</div>
            <div className="text-sm text-gray-500 dark:text-slate-400">Everything is clear for the current filter.</div>
          </div>
        ) : filtered.map(item => {
          const module = WORKFLOW_MODULES[item._module]
          return (
            <div key={`${item._module}-${item._recordId}`} className="card p-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className="grid h-10 w-10 flex-none place-items-center rounded-lg bg-amber-100 text-amber-700">
                  <i className="fas fa-clock" />
                </div>
                <div className="min-w-[220px] flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="badge badge-pending text-xs">{item._moduleLabel}</span>
                    <span className="text-xs font-bold text-gray-400">{item._recordId}</span>
                  </div>
                  <div className="mt-1 truncate font-bold text-gray-900 dark:text-gray-100" title={item._title}>{item._title}</div>
                  <div className="truncate text-sm text-gray-500 dark:text-slate-400" title={item._owner}>{item._owner}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold text-gray-900 dark:text-gray-100">{fmtCurrency(item._amount)}</div>
                  <div className="text-xs text-gray-400">{fmtDate(item[module.dateField] || item.created_at)}</div>
                </div>
                <button
                  onClick={() => navigate(makeModuleFilterUrl(module, { status: 'Pending', focus: item._recordId }))}
                  className="btn-primary text-xs"
                >
                  Open
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
