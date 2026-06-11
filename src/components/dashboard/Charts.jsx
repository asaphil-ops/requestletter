import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts'

const COLORS = { req: '#2563eb', sbar: '#7c3aed', it: '#f59e0b', at: '#10b981', comms: '#ef4444' }
const CAT_LABELS = { req: 'Request Letter', sbar: 'SBAR', it: 'IT Expenses', at: 'Aircon & Toilet', comms: 'Comms' }
const STATUS_COLORS = { Pending: '#f59e0b', Approved: '#10b981', Rejected: '#ef4444', Checked: '#2563eb' }

function buildMonthly(data) {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const now = new Date()
  const year = now.getFullYear()
  const rows = months.slice(0, now.getMonth() + 1).map((m, i) => ({
    month: m,
    submitted: data.filter(r => { try { const d = new Date(r.date || r.date_req || r.created_at); return d.getFullYear() === year && d.getMonth() === i } catch { return false } }).length,
    approved:  data.filter(r => { try { const d = new Date(r.date || r.date_req || r.created_at); return d.getFullYear() === year && d.getMonth() === i && r.status === 'Approved' } catch { return false } }).length,
  }))
  return rows
}

function buildWeekly(data) {
  const labels = ['Wk-6', 'Wk-5', 'Wk-4', 'Wk-3', 'Wk-2', 'Wk-1', 'This Wk']
  const MS_WEEK = 7 * 24 * 3600 * 1000
  return labels.map((label, i) => {
    const idx = 6 - i
    const row = { week: label, Pending: 0, Approved: 0, Rejected: 0, Checked: 0 }
    data.forEach(r => {
      try {
        const diff = Math.floor((Date.now() - new Date(r.date || r.date_req || r.created_at)) / MS_WEEK)
        if (diff === idx && r.status) row[r.status] = (row[r.status] || 0) + 1
      } catch {}
    })
    return row
  })
}

function buildCategory(data) {
  const cats = Object.keys(COLORS)
  return cats.map(k => ({ name: CAT_LABELS[k], value: data.filter(r => r._type === k).length, key: k }))
}

export function TrendChart({ data = [] }) {
  const monthly = buildMonthly(data)
  return (
    <div className="card p-5 h-full">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-800 dark:text-gray-100">Submission Trend (Monthly)</h3>
        <div className="flex gap-4 text-xs text-gray-500">
          <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-blue-600 inline-block" /> Submitted</span>
          <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-emerald-500 inline-block border-dashed border-t" /> Approved</span>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={monthly} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#9ca3af' }} />
          <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} />
          <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }} />
          <Line type="monotone" dataKey="submitted" stroke="#2563eb" strokeWidth={2} dot={{ r: 4 }} name="Submitted" />
          <Line type="monotone" dataKey="approved" stroke="#10b981" strokeWidth={2} dot={{ r: 4 }} strokeDasharray="5 4" name="Approved" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

export function CategoryChart({ data = [] }) {
  const cats = buildCategory(data)
  const total = cats.reduce((s, c) => s + c.value, 0) || 1
  return (
    <div className="card p-5 h-full">
      <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-4">By Category</h3>
      <div className="space-y-2 mb-4">
        {cats.map((c) => (
          <div key={c.key} className="flex items-center gap-2">
            <span className="text-xs text-gray-500 w-28 truncate">{c.name}</span>
            <div className="flex-1 h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all" style={{ width: `${Math.round(c.value / total * 100)}%`, background: COLORS[c.key] }} />
            </div>
            <span className="text-xs font-semibold text-gray-600 dark:text-gray-400 w-5 text-right">{c.value}</span>
          </div>
        ))}
      </div>
      <ResponsiveContainer width="100%" height={150}>
        <PieChart>
          <Pie data={cats} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={40} outerRadius={65}>
            {cats.map((c) => <Cell key={c.key} fill={COLORS[c.key]} />)}
          </Pie>
          <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}

export function StackedWeekChart({ data = [] }) {
  const weekly = buildWeekly(data)
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h3 className="font-semibold text-gray-800 dark:text-gray-100">Status by Week</h3>
        <div className="flex flex-wrap gap-3 text-xs text-gray-500">
          {Object.entries(STATUS_COLORS).map(([s, c]) => (
            <span key={s} className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: c }} /> {s}
            </span>
          ))}
        </div>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={weekly} margin={{ top: 0, right: 10, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="week" tick={{ fontSize: 11, fill: '#9ca3af' }} />
          <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} />
          <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }} />
          {Object.entries(STATUS_COLORS).map(([s, c]) => (
            <Bar key={s} dataKey={s} stackId="a" fill={c} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
