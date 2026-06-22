import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'

const TYPE_META = {
  req:    { icon: 'fa-file-alt', color: 'bg-blue-500', label: 'Request Letter', path: '/requests' },
  sbar:   { icon: 'fa-exchange-alt', color: 'bg-purple-500', label: 'SBAR', path: '/sbar' },
  it:     { icon: 'fa-laptop', color: 'bg-emerald-500', label: 'IT Expense', path: '/it-expenses' },
  at:     { icon: 'fa-fan', color: 'bg-amber-500', label: 'Aircon/Toilet', path: '/at-expenses' },
  comms:  { icon: 'fa-phone', color: 'bg-pink-500', label: 'Comms', path: '/comms-expenses' },
  cfoo:   { icon: 'fa-users', color: 'bg-cyan-500', label: 'CFOO', path: '/cost-center/cfoo' },
  init:   { icon: 'fa-lightbulb', color: 'bg-orange-500', label: 'Initiatives', path: '/cost-center/initiatives' },
  other:  { icon: 'fa-building', color: 'bg-gray-500', label: 'Other Cost Center', path: '/cost-center/other' },
}

function timeAgo(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  const diff = (Date.now() - d.getTime()) / 1000
  if (diff < 60) return 'Just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })
}

export default function ActivityFeed({ combined = [] }) {
  const navigate = useNavigate()

  const recent = useMemo(() => {
    return [...combined]
      .filter(r => r._type && r.date)
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 8)
  }, [combined])

  if (!recent.length) return null

  const handleClick = (record) => {
    const meta = TYPE_META[record._type]
    if (meta?.path) navigate(meta.path)
  }

  return (
    <div className="card p-0 overflow-hidden h-full flex flex-col">
      <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex items-center gap-2">
        <i className="fas fa-stream text-blue-500 text-xs" />
        <h3 className="font-bold text-sm text-gray-900 dark:text-white">Recent Activity</h3>
      </div>
      <div className="flex-1 overflow-y-auto max-h-[420px]">
        {recent.map((r, i) => {
          const meta = TYPE_META[r._type] || { icon: 'fa-circle', color: 'bg-gray-400', label: r._type, path: '#' }
          return (
            <button
              key={i}
              onClick={() => handleClick(r)}
              className="w-full flex items-center gap-3 px-4 py-2.5 border-b border-gray-50 dark:border-gray-800/60 hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors text-left"
            >
              <div className={`w-8 h-8 rounded-lg ${meta.color} flex items-center justify-center flex-shrink-0`}>
                <i className={`fas ${meta.icon} text-white text-[10px]`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="truncate text-sm font-medium text-gray-800 dark:text-slate-200">{r.subject || r.details || meta.label}</div>
                <div className="text-[10px] text-gray-400 dark:text-slate-500 mt-0.5 flex items-center gap-2">
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400 font-semibold uppercase tracking-wide">{meta.label}</span>
                  {r.status && <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                    r.status === 'Pending' ? 'bg-amber-100 text-amber-700' :
                    r.status === 'Checked' || r.status === 'Approved' ? 'bg-emerald-100 text-emerald-700' :
                    r.status === 'Rejected' ? 'bg-red-100 text-red-700' :
                    'bg-gray-100 text-gray-600'
                  }`}>{r.status}</span>}
                </div>
              </div>
              <div className="text-[10px] text-gray-400 dark:text-slate-500 flex-shrink-0">{timeAgo(r.date)}</div>
            </button>
          )
        })}
      </div>
    </div>
  )
}