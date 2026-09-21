import { fmtNum } from '../../lib/utils'

const CARDS = [
  { key: 'totalStaff', label: 'Total Staff', icon: 'fa-users', tone: 'slate' },
  { key: 'pending', label: 'Pending', icon: 'fa-clock', tone: 'amber' },
  { key: 'checked', label: 'Checked', icon: 'fa-check-circle', tone: 'emerald' },
  { key: 'rejected', label: 'Rejected', icon: 'fa-times-circle', tone: 'rose' },
  { key: 'emailsSent', label: 'Emails Sent', icon: 'fa-paper-plane', tone: 'violet' },
  { key: 'totalReqs', label: 'Total Requests', icon: 'fa-file-lines', tone: 'teal' },
]

const TONES = {
  slate: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-200',
  amber: 'bg-amber-100 text-amber-700 dark:bg-amber-400/15 dark:text-amber-300',
  emerald: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-300',
  rose: 'bg-rose-100 text-rose-700 dark:bg-rose-400/15 dark:text-rose-300',
  violet: 'bg-violet-100 text-violet-700 dark:bg-violet-400/15 dark:text-violet-300',
  teal: 'bg-teal-100 text-teal-700 dark:bg-teal-400/15 dark:text-teal-300',
}

const ACCENTS = {
  slate: 'from-slate-400 to-slate-300',
  amber: 'from-amber-400 to-amber-500',
  emerald: 'from-emerald-400 to-emerald-500',
  rose: 'from-rose-400 to-rose-500',
  violet: 'from-violet-400 to-violet-500',
  teal: 'from-teal-400 to-teal-500',
}

export default function StatCards({ data = {}, onCardClick }) {
  return (
    <div className="dashboard-stats grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6 mb-5">
      {CARDS.map((c) => (
        <button
          type="button"
          key={c.key}
          onClick={() => onCardClick?.(c.key)}
          className="dashboard-stat-card group relative min-w-0 overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-4 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-xl dark:border-slate-700/70 dark:bg-slate-900/60 dark:hover:border-slate-600"
          title={onCardClick ? `Open ${c.label} report` : undefined}
        >
          <div className="relative z-10 flex items-start justify-between gap-2">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">{c.label}</div>
              <div className="mt-2 text-3xl font-extrabold leading-none tracking-tight text-slate-900 dark:text-white">{fmtNum(data[c.key] ?? 0)}</div>
            </div>
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${TONES[c.tone]}`}>
              <i className={`fas ${c.icon} text-sm`} aria-hidden="true" />
            </div>
          </div>
          <div className="relative z-10 mt-4 flex items-center gap-1.5 text-[11px] font-semibold text-slate-400 transition-colors group-hover:text-slate-600 dark:text-slate-500 dark:group-hover:text-slate-300">
            <span>View details</span><i className="fas fa-arrow-right text-[9px]" aria-hidden="true" />
          </div>
          <span className={`absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r ${ACCENTS[c.tone]}`} aria-hidden="true" />
          <span className={`absolute -right-7 -top-7 h-20 w-20 rounded-full bg-gradient-to-br ${ACCENTS[c.tone]} opacity-[0.08] transition-transform duration-300 group-hover:scale-125`} aria-hidden="true" />
        </button>
      ))}
    </div>
  )
}
