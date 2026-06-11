import { fmtNum } from '../../lib/utils'

const CARDS = [
  { key: 'totalStaff',  label: 'Total Staff',     icon: 'fa-users',        gradient: 'from-blue-600 to-blue-700' },
  { key: 'pending',     label: 'Pending',          icon: 'fa-clock',        gradient: 'from-amber-500 to-amber-600' },
  { key: 'approved',    label: 'Approved',         icon: 'fa-check-circle', gradient: 'from-emerald-500 to-emerald-600' },
  { key: 'rejected',    label: 'Rejected',         icon: 'fa-times-circle', gradient: 'from-red-500 to-red-600' },
  { key: 'emailsSent',  label: 'Emails Sent',      icon: 'fa-paper-plane',  gradient: 'from-purple-600 to-purple-700' },
  { key: 'totalReqs',   label: 'Total Requests',   icon: 'fa-exchange-alt', gradient: 'from-cyan-600 to-cyan-700' },
]

export default function StatCards({ data = {} }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 mb-6">
      {CARDS.map((c) => (
        <div
          key={c.key}
          className={`bg-gradient-to-br ${c.gradient} rounded-xl p-4 text-white flex items-center gap-3 shadow-sm hover:-translate-y-0.5 transition-transform cursor-default`}
        >
          <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
            <i className={`fas ${c.icon} text-lg`} />
          </div>
          <div>
            <div className="text-2xl font-bold leading-none">{fmtNum(data[c.key] ?? 0)}</div>
            <div className="text-xs opacity-85 mt-1 font-medium">{c.label}</div>
          </div>
        </div>
      ))}
    </div>
  )
}
