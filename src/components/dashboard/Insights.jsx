import { useNavigate } from 'react-router-dom'
import { fmtNum } from '../../lib/utils'

export default function Insights({ data = {}, combined = [] }) {
  const navigate = useNavigate()
  const MS_DAY = 24 * 3600 * 1000

  const thisWeek = combined.filter(r => {
    try { return (Date.now() - new Date(r.date || r.date_req || r.created_at)) < 7 * MS_DAY } catch { return false }
  }).length

  const lastWeek = combined.filter(r => {
    try { const d = Date.now() - new Date(r.date || r.date_req || r.created_at); return d >= 7 * MS_DAY && d < 14 * MS_DAY } catch { return false }
  }).length

  const trend = lastWeek > 0 ? Math.round((thisWeek - lastWeek) / lastWeek * 100) : 0
  const trendUp = trend >= 0
  const trendColor = trendUp ? 'text-emerald-600' : 'text-red-500'

  const total = combined.length
  const approvalRate = total > 0 ? Math.round((data.approved || 0) / total * 100) : 0
  const rejectionRate = total > 0 ? Math.round((data.rejected || 0) / total * 100) : 0

  // Top category this week
  const twData = combined.filter(r => {
    try { return (Date.now() - new Date(r.date || r.date_req || r.created_at)) < 7 * MS_DAY } catch { return false }
  })
  const catCount = { req: 0, sbar: 0, it: 0, at: 0, comms: 0 }
  twData.forEach(r => { if (catCount[r._type] !== undefined) catCount[r._type]++ })
  const topCat = Object.entries(catCount).sort((a, b) => b[1] - a[1])[0]
  const catNames = { req: 'Request Letter', sbar: 'SBAR', it: 'IT Expenses', at: 'Aircon & Toilet', comms: 'Comms' }
  const topCatName = topCat ? catNames[topCat[0]] : 'N/A'
  const topCatCount = topCat ? topCat[1] : 0

  // Avg pending days
  const pendingItems = combined.filter(r => r.status === 'Pending')
  let avgDays = 0
  if (pendingItems.length > 0) {
    const total = pendingItems.reduce((s, r) => {
      try { return s + Math.floor((Date.now() - new Date(r.date || r.date_req || r.created_at)) / MS_DAY) } catch { return s }
    }, 0)
    avgDays = (total / pendingItems.length).toFixed(1)
  }

  const items = [
    {
      icon: 'fa-chart-line', bg: 'bg-blue-50 dark:bg-blue-900/20', color: 'text-blue-600',
      content: (
        <>Submission volume is <strong className={trendColor}>{trendUp ? 'up' : 'down'} {Math.abs(trend)}%</strong> vs last week. <strong>{topCatName}</strong> leads with <strong>{topCatCount}</strong> new {topCatCount === 1 ? 'entry' : 'entries'}{topCatCount > 5 ? ' — consider scheduling a batch review session.' : '.'}</>
      )
    },
    {
      icon: 'fa-clock', bg: 'bg-amber-50 dark:bg-amber-900/20', color: 'text-amber-600',
      content: (
        <><strong>{data.pending || 0} request{data.pending !== 1 ? 's' : ''}</strong> {data.pending !== 1 ? 'are' : 'is'} still Pending. Average time in Pending status is <strong>{avgDays} day{avgDays != 1 ? 's' : ''}</strong>. Ops Finance has <strong className="text-amber-600">{data.pending || 0}</strong> item{data.pending !== 1 ? 's' : ''} waiting for check, Finance has <strong className="text-blue-600">{data.checked || 0}</strong> for approval.</>
      )
    },
    {
      icon: 'fa-check-circle', bg: 'bg-emerald-50 dark:bg-emerald-900/20', color: 'text-emerald-600',
      content: (
        <div>
          <>Approval rate this period: <strong className="text-emerald-600">{approvalRate}%</strong>. Rejection rate is <strong className="text-red-500">{rejectionRate}%</strong> {rejectionRate <= 10 ? '— below the 10% threshold. System is performing well.' : '— above 10% threshold. Please review rejected items.'}</>
          <div className="flex gap-3 mt-2">
            <div className="flex-1">
              <div className="text-[10px] text-gray-400 mb-1">Approved {approvalRate}%</div>
              <div className="h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${approvalRate}%` }} />
              </div>
            </div>
            <div className="flex-1">
              <div className="text-[10px] text-gray-400 mb-1">Rejected {rejectionRate}%</div>
              <div className="h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                <div className="h-full bg-red-500 rounded-full transition-all" style={{ width: `${Math.min(rejectionRate * 4, 100)}%` }} />
              </div>
            </div>
          </div>
        </div>
      )
    },
    {
      icon: 'fa-paper-plane', bg: 'bg-purple-50 dark:bg-purple-900/20', color: 'text-purple-600',
      content: (
        <div>
          <><strong>{fmtNum(data.emailsSent || 0)} email{(data.emailsSent || 0) !== 1 ? 's' : ''}</strong> sent this period. Consider enabling CC auto-fill for Finance approvals.</>
          <button
            onClick={() => navigate('/send-email')}
            className="mt-2 inline-flex items-center gap-1.5 bg-purple-600 text-white text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-purple-700 transition-all"
          >
            <i className="fas fa-paper-plane text-[10px]" /> Go to Send Email
          </button>
        </div>
      )
    },
  ]

  return (
    <div className="card p-5 h-full flex flex-col">
      <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-4 flex items-center gap-2">
        <i className="fas fa-lightbulb text-amber-400" /> Weekly Insights
      </h3>

      <div className="space-y-3 flex-1">
        {items.map((item, i) => (
          <div key={i} className="flex gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700">
            <div className={`w-8 h-8 rounded-lg ${item.bg} flex items-center justify-center flex-shrink-0 mt-0.5`}>
              <i className={`fas ${item.icon} ${item.color} text-sm`} />
            </div>
            <div className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">{item.content}</div>
          </div>
        ))}
      </div>

      {/* Mini stat grid */}
      <div className="grid grid-cols-2 gap-2 mt-4">
        {[
          { label: 'This Week', value: thisWeek, color: 'text-blue-600' },
          { label: 'vs Last Wk', value: `${trend >= 0 ? '+' : ''}${trend}%`, color: trendColor },
          { label: 'Approval Rate', value: `${approvalRate}%`, color: 'text-emerald-600' },
          { label: 'Awaiting', value: data.pending || 0, color: 'text-amber-600' },
        ].map((s) => (
          <div key={s.label} className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-2.5 text-center border border-gray-100 dark:border-gray-700">
            <div className={`text-lg font-bold ${s.color}`}>{s.value}</div>
            <div className="text-[10px] text-gray-400 uppercase tracking-wide">{s.label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
