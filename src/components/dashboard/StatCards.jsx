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
  slate: 'bg-slate-50 text-slate-600 dark:bg-slate-900/30 dark:text-slate-300',
  amber: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  emerald: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  rose: 'bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300',
  violet: 'bg-violet-50 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300',
  teal: 'bg-teal-50 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300',
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
    <div className="grid grid-cols-2 lg:grid-cols-3 gap-6">
      {CARDS.map((c) => (
        <button
          type="button"
          key={c.key}
          onClick={() => onCardClick?.(c.key)}
          className="group relative flex flex-col items-center p-6 gap-4 text-left rounded-2xl bg-white border border-slate-200 shadow-sm hover:border-slate-300 hover:shadow-lg transition-all duration-200 dark:bg-slate-900/50 dark:border-slate-700/60 dark:hover:border-slate-600 dark:hover:shadow-xl"
          title={onCardClick ? `Open ${c.label} report` : undefined}
        >
          <div className="w-full flex items-center justify-between">
            <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl ${TONES[c.tone]}`}>
              <i className={`fas ${c.icon} text-base`} aria-hidden="true" />
            </div>
            <i className="fas fa-arrow-up-right-from-square text-[10px] text-slate-400 group-hover:text-slate-600 dark:text-slate-500" aria-hidden="true" />
          </div>
          <div className="mt-2 text-center w-full">
            <div className="text-[28px] font-extrabold leading-none tracking-tight text-slate-900 dark:text-slate-100">{fmtNum(data[c.key] ?? 0)}</div>
            <div className="mt-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400">{c.label}</div>
          </div>
          {/* Accent bar */}
          <span className={`absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r ${ACCENTS[c.tone]} opacity-0 group-hover:opacity-100 transition-opacity duration-300`} aria-hidden="true" />
        </button>
      ))}
    </div>
  )
}