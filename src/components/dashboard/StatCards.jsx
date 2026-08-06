import { fmtNum } from '../../lib/utils'

const CARDS = [
  { key: 'totalStaff', label: 'Total Staff', icon: 'fa-users', tone: 'blue' },
  { key: 'pending', label: 'Pending', icon: 'fa-clock', tone: 'amber' },
  { key: 'checked', label: 'Checked', icon: 'fa-check-circle', tone: 'emerald' },
  { key: 'rejected', label: 'Rejected', icon: 'fa-times-circle', tone: 'rose' },
  { key: 'emailsSent', label: 'Emails Sent', icon: 'fa-paper-plane', tone: 'violet' },
  { key: 'totalReqs', label: 'Total Requests', icon: 'fa-file-lines', tone: 'cyan' },
]

const TONES = {
  blue: 'bg-blue-50 text-blue-600 dark:bg-blue-400/10 dark:text-blue-300',
  amber: 'bg-amber-50 text-amber-600 dark:bg-amber-400/10 dark:text-amber-300',
  emerald: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-400/10 dark:text-emerald-300',
  rose: 'bg-rose-50 text-rose-600 dark:bg-rose-400/10 dark:text-rose-300',
  violet: 'bg-violet-50 text-violet-600 dark:bg-violet-400/10 dark:text-violet-300',
  cyan: 'bg-cyan-50 text-cyan-600 dark:bg-cyan-400/10 dark:text-cyan-300',
}

export default function StatCards({ data = {}, onCardClick }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 mb-6">
      {CARDS.map((c) => (
        <div
          key={c.key}
          onClick={() => onCardClick?.(c.key)}
          className={`card group p-4 flex items-center gap-3 hover:border-blue-200 hover:shadow-md dark:hover:border-sky-500/30 ${onCardClick ? 'cursor-pointer' : 'cursor-default'}`}
          title={onCardClick ? `Open ${c.label} report` : undefined}
        >
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${TONES[c.tone]}`}>
            <i className={`fas ${c.icon} text-lg`} />
          </div>
          <div>
            <div className="text-2xl font-extrabold leading-none text-slate-950 dark:text-white">{fmtNum(data[c.key] ?? 0)}</div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-semibold">{c.label}</div>
          </div>
        </div>
      ))}
    </div>
  )
}
