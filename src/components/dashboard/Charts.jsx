import { useState, useMemo } from 'react'
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts'
import { useNavigate } from 'react-router-dom'
import { useUIStore } from '../../store/uiStore'
import { fmtCurrency, fmtNum, IT_BUDGETS, AT_BUDGETS, COMMS_BUDGETS } from '../../lib/utils'

const COLORS = { req: '#3b82f6', sbar: '#8b5cf6', it: '#f59e0b', at: '#10b981', generator: '#f97316', comms: '#ec4899' }
const CAT_LABELS = { req: 'Request Letter', sbar: 'SBAR', it: 'IT Expenses', at: 'Aircon & Toilet', generator: 'Generator', comms: 'Comms' }
const STATUS_COLORS = { Pending: '#f59e0b', Checked: '#10b981', Rejected: '#f43f5e' }

function fmtCompactPeso(n) {
  const num = Number(n || 0)
  if (num >= 1_000_000) return `₱${(num / 1_000_000).toFixed(2)}M`
  if (num >= 1_000) return `₱${(num / 1_000).toFixed(1)}K`
  return `₱${num.toLocaleString('en-PH')}`
}

function buildMonthly(data) {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const now = new Date()
  const year = now.getFullYear()
  return months.slice(0, now.getMonth() + 1).map((m, i) => {
    const monthRecords = data.filter(r => {
      try {
        const d = new Date(r.date || r.date_req || r.created_at)
        return d.getFullYear() === year && d.getMonth() === i
      } catch {
        return false
      }
    })
    const checkedRecords = monthRecords.filter(r => r.status === 'Checked')
    return {
      month: m,
      submitted: monthRecords.length,
      checked: checkedRecords.length,
      submittedAmt: monthRecords.reduce((sum, r) => sum + Number(r.amount || 0), 0),
      checkedAmt: checkedRecords.reduce((sum, r) => sum + Number(r.amount || 0), 0),
    }
  })
}

function buildWeekly(data) {
  const labels = ['Wk-6', 'Wk-5', 'Wk-4', 'Wk-3', 'Wk-2', 'Wk-1', 'This Wk']
  const MS_WEEK = 7 * 24 * 3600 * 1000
  return labels.map((label, i) => {
    const idx = 6 - i
    const row = { week: label, Pending: 0, Checked: 0, Rejected: 0 }
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
  return cats.map(k => {
    const rows = data.filter(r => r._type === k)
    return {
      name: CAT_LABELS[k],
      value: rows.length,
      amount: rows.reduce((sum, r) => sum + Number(r.amount || 0), 0),
      key: k,
    }
  })
}

function getTooltipStyle(darkMode) {
  return {
    fontSize: 12,
    fontWeight: 600,
    borderRadius: 12,
    border: darkMode ? '1px solid #334155' : '1px solid #e2e8f0',
    backgroundColor: darkMode ? 'rgba(15, 23, 42, 0.94)' : 'rgba(255, 255, 255, 0.96)',
    color: darkMode ? '#f8fafc' : '#0f172a',
    boxShadow: '0 10px 25px -5px rgba(15, 23, 42, 0.15)',
    backdropFilter: 'blur(8px)',
  }
}

export function TrendChart({ data = [] }) {
  const darkMode = useUIStore((s) => s.darkMode)
  const [mode, setMode] = useState('count') // 'count' | 'amount'
  const monthly = useMemo(() => buildMonthly(data), [data])
  const gridColor = darkMode ? 'rgba(148, 163, 184, 0.12)' : '#f1f5f9'
  const axisColor = darkMode ? '#94a3b8' : '#64748b'

  const subKey = mode === 'amount' ? 'submittedAmt' : 'submitted'
  const chkKey = mode === 'amount' ? 'checkedAmt' : 'checked'

  return (
    <div className="card p-6 h-full flex flex-col">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-5">
        <div>
          <h3 className="font-bold text-slate-900 dark:text-slate-100">Submission Trend (Monthly)</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {mode === 'amount' ? 'Year-to-date Peso (₱) volume submitted vs. checked' : 'Year-to-date submitted vs. checked entry volume'}
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex gap-3 text-xs font-semibold text-slate-600 dark:text-slate-300">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block ring-4 ring-blue-500/15" /> Submitted
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block ring-4 ring-emerald-500/15" /> Checked
            </span>
          </div>
          <div className="inline-flex rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100/80 dark:bg-slate-800 p-0.5 text-[11px] font-bold">
            <button
              type="button"
              onClick={() => setMode('count')}
              className={`rounded-lg px-2.5 py-1 transition-all ${mode === 'count' ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs' : 'text-slate-500 dark:text-slate-400'}`}
            >
              Entries
            </button>
            <button
              type="button"
              onClick={() => setMode('amount')}
              className={`rounded-lg px-2.5 py-1 transition-all ${mode === 'amount' ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs' : 'text-slate-500 dark:text-slate-400'}`}
            >
              ₱ Amount
            </button>
          </div>
        </div>
      </div>
      <div className="flex-1 min-h-[250px]">
        <ResponsiveContainer width="100%" height={255}>
          <AreaChart data={monthly} margin={{ top: 8, right: 10, left: mode === 'amount' ? 0 : -20, bottom: 0 }}>
            <defs>
              <linearGradient id="gradSubmitted" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.28} />
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0} />
              </linearGradient>
              <linearGradient id="gradChecked" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.24} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridColor} />
            <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: axisColor, fontWeight: 600 }} />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11, fill: axisColor }}
              tickFormatter={mode === 'amount' ? fmtCompactPeso : undefined}
            />
            <Tooltip
              contentStyle={getTooltipStyle(darkMode)}
              formatter={(value, name) => [mode === 'amount' ? fmtCurrency(value) : fmtNum(value), name]}
            />
            <Area type="monotone" dataKey={subKey} stroke="#3b82f6" strokeWidth={2.5} fillOpacity={1} fill="url(#gradSubmitted)" activeDot={{ r: 5, strokeWidth: 0 }} name="Submitted" />
            <Area type="monotone" dataKey={chkKey} stroke="#10b981" strokeWidth={2.5} strokeDasharray="5 4" fillOpacity={1} fill="url(#gradChecked)" activeDot={{ r: 5, strokeWidth: 0 }} name="Checked" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

export function CategoryChart({ data = [] }) {
  const darkMode = useUIStore((s) => s.darkMode)
  const [metric, setMetric] = useState('value') // 'value' | 'amount'
  const cats = useMemo(() => buildCategory(data), [data])
  const totalCount = cats.reduce((s, c) => s + c.value, 0)
  const totalAmount = cats.reduce((s, c) => s + c.amount, 0)
  const activeTotal = (metric === 'amount' ? totalAmount : totalCount) || 1

  return (
    <div className="card p-6 h-full flex flex-col">
      <div className="flex items-center justify-between gap-2 mb-4">
        <div>
          <h3 className="font-bold text-slate-900 dark:text-slate-100">By Module Category</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Distribution across operational modules</p>
        </div>
        <div className="inline-flex rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100/80 dark:bg-slate-800 p-0.5 text-[11px] font-bold">
          <button
            type="button"
            onClick={() => setMetric('value')}
            className={`rounded-lg px-2 py-1 transition-all ${metric === 'value' ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs' : 'text-slate-500 dark:text-slate-400'}`}
          >
            Count
          </button>
          <button
            type="button"
            onClick={() => setMetric('amount')}
            className={`rounded-lg px-2 py-1 transition-all ${metric === 'amount' ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs' : 'text-slate-500 dark:text-slate-400'}`}
          >
            ₱ Share
          </button>
        </div>
      </div>

      <div className="space-y-2.5 mb-4">
        {cats.map((c) => {
          const val = metric === 'amount' ? c.amount : c.value
          const pct = Math.round((val / activeTotal) * 100)
          return (
            <div key={c.key} className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: COLORS[c.key] }} />
              <span className="text-xs font-medium text-slate-600 dark:text-slate-300 w-28 truncate">{c.name}</span>
              <div className="flex-1 h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: COLORS[c.key] }} />
              </div>
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 w-20 text-right tabular-nums">
                {metric === 'amount' ? fmtCompactPeso(c.amount) : fmtNum(c.value)}
              </span>
            </div>
          )
        })}
      </div>

      <div className="relative mt-auto">
        <ResponsiveContainer width="100%" height={155}>
          <PieChart>
            <Pie data={cats} dataKey={metric} nameKey="name" cx="50%" cy="50%" innerRadius={44} outerRadius={68} paddingAngle={2}>
              {cats.map((c) => <Cell key={c.key} fill={COLORS[c.key]} stroke="transparent" />)}
            </Pie>
            <Tooltip
              contentStyle={getTooltipStyle(darkMode)}
              formatter={(v) => [metric === 'amount' ? fmtCurrency(v) : fmtNum(v)]}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-sm font-extrabold text-slate-900 dark:text-white tabular-nums leading-none">
            {metric === 'amount' ? fmtCompactPeso(totalAmount) : fmtNum(totalCount)}
          </span>
          <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mt-1">
            {metric === 'amount' ? 'Total Volume' : 'Total Entries'}
          </span>
        </div>
      </div>
    </div>
  )
}

export function StackedWeekChart({ data = [] }) {
  const darkMode = useUIStore((s) => s.darkMode)
  const weekly = useMemo(() => buildWeekly(data), [data])
  const gridColor = darkMode ? 'rgba(148, 163, 184, 0.12)' : '#f1f5f9'
  const axisColor = darkMode ? '#94a3b8' : '#64748b'

  return (
    <div className="card p-6 h-full">
      <div className="flex items-center justify-between mb-5 flex-wrap gap-2">
        <div>
          <h3 className="font-bold text-slate-900 dark:text-slate-100">Status by Week</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Last 7 weeks breakdown by review status</p>
        </div>
        <div className="flex flex-wrap gap-3.5 text-xs font-semibold text-slate-600 dark:text-slate-300">
          {Object.entries(STATUS_COLORS).map(([s, c]) => (
            <span key={s} className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: c }} /> {s}
            </span>
          ))}
        </div>
      </div>
      <ResponsiveContainer width="100%" height={230}>
        <BarChart data={weekly} margin={{ top: 4, right: 10, left: -20, bottom: 0 }} barSize={28}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridColor} />
          <XAxis dataKey="week" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: axisColor, fontWeight: 600 }} />
          <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: axisColor }} />
          <Tooltip cursor={{ fill: darkMode ? 'rgba(148, 163, 184, 0.06)' : 'rgba(15, 23, 42, 0.04)' }} contentStyle={getTooltipStyle(darkMode)} />
          <Bar dataKey="Checked" stackId="a" fill={STATUS_COLORS.Checked} radius={[0, 0, 4, 4]} />
          <Bar dataKey="Pending" stackId="a" fill={STATUS_COLORS.Pending} />
          <Bar dataKey="Rejected" stackId="a" fill={STATUS_COLORS.Rejected} radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export function PendingAgingCard({ data = [] }) {
  const navigate = useNavigate()
  const MS_DAY = 24 * 3600 * 1000

  const aging = useMemo(() => {
    const pending = data.filter(r => r.status === 'Pending')
    let fresh = 0, warning = 0, overdue = 0
    let freshAmt = 0, warningAmt = 0, overdueAmt = 0

    const withAge = pending.map(r => {
      const d = new Date(r.date || r.date_req || r.created_at)
      const days = Number.isNaN(d.getTime()) ? 0 : Math.max(0, Math.floor((Date.now() - d.getTime()) / MS_DAY))
      const amt = Number(r.amount || 0)
      if (days <= 2) { fresh++; freshAmt += amt }
      else if (days <= 7) { warning++; warningAmt += amt }
      else { overdue++; overdueAmt += amt }
      return { ...r, _days: days }
    }).sort((a, b) => b._days - a._days)

    return {
      total: pending.length,
      fresh, warning, overdue,
      freshAmt, warningAmt, overdueAmt,
      oldest: withAge.slice(0, 4),
    }
  }, [data])

  const buckets = [
    { key: 'fresh', label: 'Fresh (0–2 days)', count: aging.fresh, amount: aging.freshAmt, tone: 'bg-emerald-500', badge: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-300 border-emerald-200/70 dark:border-emerald-400/20' },
    { key: 'warning', label: 'Needs Attention (3–7 days)', count: aging.warning, amount: aging.warningAmt, tone: 'bg-amber-500', badge: 'bg-amber-50 text-amber-700 dark:bg-amber-400/15 dark:text-amber-300 border-amber-200/70 dark:border-amber-400/20' },
    { key: 'overdue', label: 'Overdue (> 7 days)', count: aging.overdue, amount: aging.overdueAmt, tone: 'bg-rose-500', badge: 'bg-rose-50 text-rose-700 dark:bg-rose-400/15 dark:text-rose-300 border-rose-200/70 dark:border-rose-400/20' },
  ]

  return (
    <div className="card p-6 h-full flex flex-col">
      <div className="flex items-center justify-between gap-2 mb-4">
        <div>
          <h3 className="font-bold text-slate-900 dark:text-slate-100">Pending SLA &amp; Aging</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Bottleneck tracker for unreviewed requests</p>
        </div>
        <button
          type="button"
          onClick={() => navigate('/reports?status=Pending')}
          className="text-xs font-bold text-blue-600 hover:text-blue-700 dark:text-sky-400"
        >
          Review all ({aging.total}) →
        </button>
      </div>

      {/* Stacked visual progress bar */}
      <div className="h-3 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden flex mb-4">
        {aging.total > 0 ? buckets.map(b => (
          <div
            key={b.key}
            style={{ width: `${(b.count / aging.total) * 100}%` }}
            className={`${b.tone} h-full transition-all duration-500`}
            title={`${b.label}: ${b.count}`}
          />
        )) : (
          <div className="bg-emerald-500 h-full w-full opacity-30" />
        )}
      </div>

      <div className="grid grid-cols-1 gap-2.5 mb-4">
        {buckets.map(b => (
          <div key={b.key} className={`flex items-center justify-between rounded-xl border px-3.5 py-2.5 ${b.badge}`}>
            <div className="flex items-center gap-2.5 min-w-0">
              <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${b.tone}`} />
              <span className="text-xs font-bold truncate">{b.label}</span>
            </div>
            <div className="text-right tabular-nums shrink-0">
              <span className="text-sm font-extrabold">{fmtNum(b.count)}</span>
              {b.amount > 0 && <span className="ml-2 text-[11px] font-semibold opacity-80">({fmtCompactPeso(b.amount)})</span>}
            </div>
          </div>
        ))}
      </div>

      {aging.oldest.length > 0 && (
        <div className="mt-auto border-t border-slate-100 dark:border-slate-800 pt-3">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">Oldest Awaiting Review</div>
          <div className="space-y-1.5">
            {aging.oldest.map((item, idx) => (
              <div key={item.id || idx} className="flex items-center justify-between gap-2 text-xs">
                <span className="truncate font-medium text-slate-700 dark:text-slate-300">
                  <span className="font-bold text-slate-500 dark:text-slate-400 mr-1.5">[{CAT_LABELS[item._type] || item._type}]</span>
                  {item.title || item.category || item.beneficiary || item.branch_code || `Record #${item.id}`}
                </span>
                <span className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-extrabold tabular-nums ${item._days > 7 ? 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300'}`}>
                  {item._days}d ago
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export function TopBranchesCard({ data = [], branchMap = {}, getRecordBranchCode }) {
  const [groupBy, setGroupBy] = useState('branch') // 'branch' | 'region'

  const rankings = useMemo(() => {
    const counts = {}
    data.forEach(r => {
      const code = getRecordBranchCode ? getRecordBranchCode(r) : String(r.branch_code || '').trim().toUpperCase()
      if (!code) return
      const branch = branchMap[code]
      const key = groupBy === 'region'
        ? (branch?.region || branch?.division || 'Unassigned Region')
        : (branch ? `${branch.code} - ${branch.name}` : code)

      if (!counts[key]) counts[key] = { label: key, count: 0, amount: 0, checked: 0 }
      counts[key].count += 1
      counts[key].amount += Number(r.amount || 0)
      if (r.status === 'Checked') counts[key].checked += 1
    })

    return Object.values(counts)
      .sort((a, b) => (b.amount - a.amount) || (b.count - a.count))
      .slice(0, 5)
  }, [data, branchMap, getRecordBranchCode, groupBy])

  const maxCount = Math.max(...rankings.map(r => r.count), 1)

  return (
    <div className="card p-6 h-full flex flex-col">
      <div className="flex items-center justify-between gap-2 mb-4">
        <div>
          <h3 className="font-bold text-slate-900 dark:text-slate-100">Top Active {groupBy === 'region' ? 'Regions' : 'Branches'}</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Ranked by financial volume &amp; activity</p>
        </div>
        <div className="inline-flex rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100/80 dark:bg-slate-800 p-0.5 text-[11px] font-bold">
          <button
            type="button"
            onClick={() => setGroupBy('branch')}
            className={`rounded-lg px-2.5 py-1 transition-all ${groupBy === 'branch' ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs' : 'text-slate-500 dark:text-slate-400'}`}
          >
            Branches
          </button>
          <button
            type="button"
            onClick={() => setGroupBy('region')}
            className={`rounded-lg px-2.5 py-1 transition-all ${groupBy === 'region' ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs' : 'text-slate-500 dark:text-slate-400'}`}
          >
            Regions
          </button>
        </div>
      </div>

      {rankings.length === 0 ? (
        <div className="flex-1 flex items-center justify-center py-8 text-xs text-slate-400">
          No branch-linked records in current filter.
        </div>
      ) : (
        <div className="space-y-3.5 flex-1">
          {rankings.map((item, idx) => (
            <div key={item.label} className="space-y-1.5">
              <div className="flex items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-extrabold ${idx === 0 ? 'bg-amber-100 text-amber-700 dark:bg-amber-400/20 dark:text-amber-300' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'}`}>
                    {idx + 1}
                  </span>
                  <span className="font-bold text-slate-800 dark:text-slate-200 truncate">{item.label}</span>
                </div>
                <div className="shrink-0 text-right tabular-nums">
                  <span className="font-extrabold text-slate-900 dark:text-white">{fmtCompactPeso(item.amount)}</span>
                  <span className="ml-1.5 text-[11px] font-semibold text-slate-400">({item.count} {item.count === 1 ? 'req' : 'reqs'})</span>
                </div>
              </div>
              <div className="h-2 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-blue-500 to-sky-400 transition-all duration-500"
                  style={{ width: `${Math.max(12, Math.round((item.count / maxCount) * 100))}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function BudgetSnapshotCard({ data = [], customBudgets = {} }) {
  const navigate = useNavigate()

  const budgetRows = useMemo(() => {
    const itB = { ...IT_BUDGETS, ...(customBudgets?.it || {}) }
    const atB = { ...AT_BUDGETS, ...(customBudgets?.at || {}) }
    const cmB = { ...COMMS_BUDGETS, ...(customBudgets?.comms || {}) }

    const sumCat = (type, cat) =>
      data
        .filter(r => r._type === type && r.status !== 'Rejected' && (!cat || String(r.category || '').toLowerCase() === cat.toLowerCase()))
        .reduce((s, r) => s + Number(r.amount || 0), 0)

    const items = [
      { label: 'IT — CCTV', module: '/it-expenses', used: sumCat('it', 'CCTV'), budget: Number(itB.CCTV || 0), color: 'bg-blue-500' },
      { label: 'IT — Printer', module: '/it-expenses', used: sumCat('it', 'Printer'), budget: Number(itB.Printer || 0), color: 'bg-sky-500' },
      { label: 'IT — Monitor', module: '/it-expenses', used: sumCat('it', 'Monitor'), budget: Number(itB.Monitor || 0), color: 'bg-indigo-500' },
      { label: 'Aircon Maintenance', module: '/at-expenses', used: sumCat('at', 'Aircon'), budget: Number(atB.Aircon || 0), color: 'bg-teal-500' },
      { label: 'Toilet Maintenance', module: '/at-expenses', used: sumCat('at', 'Toilet'), budget: Number(atB.Toilet || 0), color: 'bg-emerald-500' },
      { label: 'Comms — Signage', module: '/comms-expenses', used: sumCat('comms', 'Branch Signage'), budget: Number(cmB['Branch Signage'] || 0), color: 'bg-rose-500' },
    ]

    return items.filter(i => i.budget > 0)
  }, [data, customBudgets])

  return (
    <div className="card p-6 h-full flex flex-col">
      <div className="flex items-center justify-between gap-2 mb-4">
        <div>
          <h3 className="font-bold text-slate-900 dark:text-slate-100">Budget Utilization Snapshot</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Allocated budget vs. active spend (Checked + Pending)</p>
        </div>
        <button
          type="button"
          onClick={() => navigate('/budget')}
          className="text-xs font-bold text-blue-600 hover:text-blue-700 dark:text-sky-400"
        >
          Full Budget →
        </button>
      </div>

      <div className="space-y-3 flex-1">
        {budgetRows.map((row) => {
          const pct = Math.min(100, Math.round((row.used / row.budget) * 100))
          const isHigh = pct >= 85
          return (
            <button
              key={row.label}
              type="button"
              onClick={() => navigate(row.module)}
              className="w-full text-left group rounded-xl p-2 -mx-2 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
            >
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="font-bold text-slate-700 dark:text-slate-200 group-hover:text-blue-600 dark:group-hover:text-sky-300 transition-colors">
                  {row.label}
                </span>
                <span className="tabular-nums font-semibold text-slate-500 dark:text-slate-400">
                  <strong className={isHigh ? 'text-rose-600 dark:text-rose-400' : 'text-slate-900 dark:text-white'}>
                    {fmtCompactPeso(row.used)}
                  </strong>
                  {' / '}
                  {fmtCompactPeso(row.budget)} ({pct}%)
                </span>
              </div>
              <div className="h-2 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${isHigh ? 'bg-rose-500' : row.color}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
