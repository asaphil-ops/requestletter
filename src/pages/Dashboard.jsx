import { useState, useMemo } from 'react'
import { BarChart3, CalendarDays, ChevronDown, FilePlus2, Mail, UploadCloud, Wallet, Clock, CheckCircle2, TrendingUp } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { useDashboard } from '../hooks/useDashboard'
import { useStaff } from '../hooks/useStaff'
import { useSettings } from '../hooks/useAccounts'
import { branchCodesMatch, useBranchMap, useBranchOptions, useBranches } from '../hooks/useBranches'
import { fmtCurrency } from '../lib/utils'
import StatCards from '../components/dashboard/StatCards'
import { TrendChart, CategoryChart, StackedWeekChart, PendingAgingCard, TopBranchesCard, BudgetSnapshotCard } from '../components/dashboard/Charts'
import Insights from '../components/dashboard/Insights'
import ActivityFeed from '../components/dashboard/ActivityFeed'
import { PageLoader } from '../components/shared/Loader'
import SegmentedSearchSelect from '../components/shared/SegmentedSearchSelect'
import PageHeader from '../components/shared/PageHeader'

const EMPTY_FILTERS = { operation: '', division: '', region: '', area: '', branchCode: '', category: '', dateStart: '', dateEnd: '' }

export default function Dashboard() {
  const { user, canUpload, isAdmin } = useAuthStore()
  const navigate = useNavigate()
  const { data: dash, isLoading } = useDashboard()
  const { data: staff = [] } = useStaff()
  const { data: branches = [] } = useBranches()
  const { data: settings } = useSettings()
  const branchOptions = useBranchOptions()
  const branchMap = useBranchMap()
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const activeFilters = Object.entries(filters).filter(([, value]) => value)

  const set = (key, val) => {
    setFilters(prev => {
      const next = { ...prev, [key]: val }
      if (key === 'operation') { next.division = ''; next.region = ''; next.area = ''; next.branchCode = '' }
      if (key === 'division')  { next.region = ''; next.area = ''; next.branchCode = '' }
      if (key === 'region')    { next.area = ''; next.branchCode = '' }
      if (key === 'area')      { next.branchCode = '' }
      return next
    })
  }

  const branchMatchesFilters = (branch = {}, { ignoreKey = '', includeBranchCode = false } = {}) => (
    (ignoreKey === 'operation' || !filters.operation || branch.operation === filters.operation) &&
    (ignoreKey === 'division' || !filters.division || branch.division === filters.division) &&
    (ignoreKey === 'region' || !filters.region || branch.region === filters.region) &&
    (ignoreKey === 'area' || !filters.area || branch.area === filters.area) &&
    (!includeBranchCode || !filters.branchCode || branchCodesMatch(branch.code, filters.branchCode))
  )

  // Cascading filter options from branch master data.
  const geoOptions = useMemo(() => {
    const optionsFor = (key) => [...new Set(
      branches
        .filter(branch => branchMatchesFilters(branch, { ignoreKey: key }))
        .map(branch => branch[key])
        .filter(Boolean)
    )].sort()

    const filteredBranches = branchOptions.filter(branch =>
      branchMatchesFilters(branch, { ignoreKey: 'branchCode' })
    )

    return {
      operations: optionsFor('operation'),
      divisions: optionsFor('division'),
      regions: optionsFor('region'),
      areas: optionsFor('area'),
      branches: filteredBranches,
    }
  }, [branches, branchOptions, filters.operation, filters.division, filters.region, filters.area, filters.branchCode])

  const staffBranchMap = useMemo(() => {
    const map = {}
    staff.forEach((row) => {
      const code = String(row.branch_code || '').trim().toUpperCase()
      if (!code) return
      const names = [
        row.name,
        row.full_name,
        `${row.first_name || ''} ${row.last_name || ''}`.trim(),
        `${row.last_name || ''}, ${row.first_name || ''}`.trim(),
      ].filter(Boolean)
      names.forEach(name => { map[String(name).toLowerCase()] = code })
    })
    return map
  }, [staff])

  const getRecordBranchCode = (record = {}) => {
    if (['it', 'at', 'generator', 'comms'].includes(record._type)) return String(record.branch_code || '').trim().toUpperCase()
    if (record._type === 'req') {
      const beneficiary = String(record.beneficiary || '').trim()
      const branchCode = beneficiary.match(/^([A-Z0-9]+)\s*-/i)?.[1]
      return String(branchCode || staffBranchMap[beneficiary.toLowerCase()] || '').trim().toUpperCase()
    }
    if (record._type === 'sbar') {
      return String(record.giver || '').trim().match(/^([A-Z0-9]+)\s*-/i)?.[1]?.toUpperCase() || ''
    }
    return ''
  }

  const recordMatchesGeo = (record = {}) => {
    if (!filters.branchCode && !filters.operation && !filters.division && !filters.region && !filters.area) return true
    const code = getRecordBranchCode(record)
    if (filters.branchCode && !branchCodesMatch(code, filters.branchCode)) return false
    const branch = branchMap[code]
    if (!branch) return false
    return branchMatchesFilters(branch, { includeBranchCode: true })
  }

  // Normalize old 'Approved' status to 'Checked' throughout the app
  const combined = useMemo(() => {
    if (!dash?.combined) return []
    const normalized = dash.combined.map(r => ({
      ...r,
      status: r.status === 'Approved' ? 'Checked' : r.status,
    }))
    return normalized.filter(r => {
      if (filters.category && r._type !== filters.category) return false
      if (filters.dateStart && filters.dateEnd) {
        try {
          const d = new Date(r.date || r.date_req || r.created_at)
          const s = new Date(filters.dateStart); s.setHours(0, 0, 0, 0)
          const e = new Date(filters.dateEnd);   e.setHours(23, 59, 59, 999)
          if (d < s || d > e) return false
        } catch {}
      }
      if (!recordMatchesGeo(r)) return false
      return true
    })
  }, [dash, filters, branchMap, staffBranchMap])

  const filteredStaffCount = useMemo(() => {
    if (!filters.operation && !filters.division && !filters.region && !filters.area && !filters.branchCode) {
      return dash?.totalStaff || 0
    }
    return staff.filter((row) => {
      const code = String(row.branch_code || '').trim().toUpperCase()
      if (filters.branchCode && !branchCodesMatch(code, filters.branchCode)) return false
      const branch = branchMap[code]
      if (!branch) return false
      return branchMatchesFilters(branch, { includeBranchCode: true })
    }).length
  }, [staff, branchMap, filters, dash])

  const statsData = useMemo(() => {
    if (!combined.length && !dash) return {}
    const s = (status) => combined.filter(r => r.status === status).length
    return {
      totalStaff: filteredStaffCount,
      pending:    s('Pending'),
      checked:    s('Checked'),
      rejected:   s('Rejected'),
      emailsSent: dash?.emailsSent || 0,
      totalReqs:  combined.length,
    }
  }, [combined, filteredStaffCount, dash])

  const financialStats = useMemo(() => {
    const sumAmt = (arr) => arr.reduce((sum, r) => sum + Number(r.amount || 0), 0)
    const checkedRows = combined.filter(r => r.status === 'Checked')
    const pendingRows = combined.filter(r => r.status === 'Pending')
    const totalAmt = sumAmt(combined)
    const checkedAmt = sumAmt(checkedRows)
    const pendingAmt = sumAmt(pendingRows)
    const avgAmt = combined.length > 0 ? totalAmt / combined.length : 0
    const completionRate = combined.length > 0 ? Math.round((checkedRows.length / combined.length) * 100) : 0

    return { totalAmt, checkedAmt, pendingAmt, avgAmt, completionRate }
  }, [combined])

  const today = new Date().toLocaleDateString('en-PH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
  const selectOptions = (items) => items.map(item => ({ value: item, label: item }))
  const openDashboardReport = (key) => {
    const statusMap = { pending: 'Pending', checked: 'Checked', rejected: 'Rejected' }
    const params = new URLSearchParams()
    if (statusMap[key]) params.set('status', statusMap[key])
    navigate(`/reports${params.toString() ? `?${params.toString()}` : ''}`)
  }

  if (isLoading) return <PageLoader />

  return (
    <div className="dashboard-page">
      <PageHeader
        className="dashboard-hero"
        eyebrow="Operations overview"
        title={`Good day, ${user?.full_name?.split(',')[0] || 'Team'}`}
        subtitle="Monitor requests, financial volume, budget utilization, and operational activity in one place."
        icon={<BarChart3 size={21} strokeWidth={2.2} />}
        actions={<span className="dashboard-date text-sm font-semibold"><CalendarDays size={15} />{today}</span>}
      />

      <section className="dashboard-shortcuts" aria-label="Quick actions">
        <span className="dashboard-shortcuts-title">Quick actions</span>
        {canUpload && <button type="button" className="dashboard-shortcut" onClick={() => navigate('/requests?quickAction=new')}><FilePlus2 size={16} />New Request</button>}
        {isAdmin && <button type="button" className="dashboard-shortcut" onClick={() => navigate('/bulk-upload')}><UploadCloud size={16} />Upload File</button>}
        <button type="button" className="dashboard-shortcut" onClick={() => navigate('/send-email')}><Mail size={16} />Send to Email</button>
      </section>

      {/* Dashboard Filters */}
      <div className="card dashboard-filter relative z-30 overflow-visible p-4 mb-4">
        <div className="mb-2 flex items-center justify-between gap-3">
          <div><h2 className="text-sm font-extrabold text-slate-900 dark:text-white">Filter overview</h2><p className="text-xs text-slate-500 dark:text-slate-400">Refine the dashboard without losing context.</p></div>
          {activeFilters.length > 0 && <button onClick={() => setFilters(EMPTY_FILTERS)} className="text-xs font-bold text-blue-600 hover:text-blue-700 dark:text-sky-300">Clear all</button>}
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 items-end">
          <div>
            <label className="label">Date range</label>
            <div className="dashboard-date-range">
              <input type="date" aria-label="Date start" className="dashboard-filter-control" value={filters.dateStart} onChange={e => set('dateStart', e.target.value)} />
              <span>to</span>
              <input type="date" aria-label="Date end" className="dashboard-filter-control" value={filters.dateEnd} onChange={e => set('dateEnd', e.target.value)} />
            </div>
          </div>
          <div>
            <label className="label">Category</label>
            <select className="dashboard-filter-control" value={filters.category} onChange={e => set('category', e.target.value)}>
              <option value="">All Categories</option>
              <option value="req">Request Letter</option>
              <option value="sbar">SBAR</option>
              <option value="it">IT Expenses</option>
              <option value="at">Aircon &amp; Toilet</option>
              <option value="generator">Generator</option>
              <option value="comms">Comms</option>
            </select>
          </div>
          <div><label className="label">Branch</label><SegmentedSearchSelect label="" value={filters.branchCode} options={geoOptions.branches} onChange={value => set('branchCode', value)} className="w-full" /></div>
        </div>
        <details className="mt-3 border-t border-slate-100 pt-3 dark:border-slate-800">
          <summary className="cursor-pointer text-xs font-bold text-slate-600 dark:text-slate-300">Advanced geographic filters <ChevronDown className="ml-1 inline" size={13} /></summary>
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <SegmentedSearchSelect label="Operation" value={filters.operation} options={selectOptions(geoOptions.operations)} onChange={value => set('operation', value)} className="w-full" />
            <SegmentedSearchSelect label="Division" value={filters.division} options={selectOptions(geoOptions.divisions)} onChange={value => set('division', value)} className="w-full" />
            <SegmentedSearchSelect label="Region" value={filters.region} options={selectOptions(geoOptions.regions)} onChange={value => set('region', value)} className="w-full" />
            <SegmentedSearchSelect label="Area" value={filters.area} options={selectOptions(geoOptions.areas)} onChange={value => set('area', value)} className="w-full" />
          </div>
        </details>
        {activeFilters.length > 0 && <div className="mt-3 flex flex-wrap gap-2" aria-label="Active filters">{activeFilters.map(([key, value]) => <button key={key} onClick={() => set(key, '')} className="filter-chip"><span className="capitalize">{key.replace('branchCode', 'branch')}</span>: {value}<i className="fas fa-times" /></button>)}</div>}
      </div>

      {/* Stat Cards */}
      <StatCards data={statsData} onCardClick={openDashboardReport} />

      {/* Financial Volume Summary Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 mb-5">
        <div className="card p-4 flex items-center gap-3.5 border-l-4 border-l-emerald-500">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300">
            <CheckCircle2 size={20} strokeWidth={2.2} />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Checked Volume (₱)</div>
            <div className="mt-0.5 text-xl font-extrabold text-slate-900 dark:text-white tabular-nums truncate">{fmtCurrency(financialStats.checkedAmt)}</div>
            <div className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">{financialStats.completionRate}% completion rate</div>
          </div>
        </div>

        <div className="card p-4 flex items-center gap-3.5 border-l-4 border-l-amber-500">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300">
            <Clock size={20} strokeWidth={2.2} />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Pending Review (₱)</div>
            <div className="mt-0.5 text-xl font-extrabold text-slate-900 dark:text-white tabular-nums truncate">{fmtCurrency(financialStats.pendingAmt)}</div>
            <div className="text-[11px] font-semibold text-amber-600 dark:text-amber-400">{statsData.pending || 0} awaiting checking</div>
          </div>
        </div>

        <div className="card p-4 flex items-center gap-3.5 border-l-4 border-l-blue-500">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300">
            <Wallet size={20} strokeWidth={2.2} />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Submitted (₱)</div>
            <div className="mt-0.5 text-xl font-extrabold text-slate-900 dark:text-white tabular-nums truncate">{fmtCurrency(financialStats.totalAmt)}</div>
            <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Across {statsData.totalReqs || 0} total entries</div>
          </div>
        </div>

        <div className="card p-4 flex items-center gap-3.5 border-l-4 border-l-violet-500">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300">
            <TrendingUp size={20} strokeWidth={2.2} />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Average Request (₱)</div>
            <div className="mt-0.5 text-xl font-extrabold text-slate-900 dark:text-white tabular-nums truncate">{fmtCurrency(Math.round(financialStats.avgAmt))}</div>
            <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Per submitted transaction</div>
          </div>
        </div>
      </div>

      {/* Analytics Row 1: Trend Chart (Count/₱) + Category Donut (Count/₱) */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 mb-4">
        <div className="xl:col-span-2">
          <TrendChart data={combined} />
        </div>
        <div>
          <CategoryChart data={combined} />
        </div>
      </div>

      {/* Analytics Row 2: Pending SLA Aging + Top Branches/Regions Leaderboard + Budget Utilization Snapshot */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        <div>
          <PendingAgingCard data={combined} />
        </div>
        <div>
          <TopBranchesCard data={combined} branchMap={branchMap} getRecordBranchCode={getRecordBranchCode} />
        </div>
        <div>
          <BudgetSnapshotCard data={combined} customBudgets={settings?.budgets} />
        </div>
      </div>

      {/* Analytics Row 3: Weekly Status Breakdown + Insights + Recent Activity */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div>
          <StackedWeekChart data={combined} />
        </div>
        <div>
          <Insights data={statsData} combined={combined} />
        </div>
        <div>
          <ActivityFeed combined={combined} />
        </div>
      </div>
    </div>
  )
}
