import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { useDashboard } from '../hooks/useDashboard'
import { useStaff } from '../hooks/useStaff'
import { branchCodesMatch, useBranchMap, useBranchOptions, useBranches } from '../hooks/useBranches'
import StatCards from '../components/dashboard/StatCards'
import { TrendChart, CategoryChart, StackedWeekChart } from '../components/dashboard/Charts'
import Insights from '../components/dashboard/Insights'
import ActivityFeed from '../components/dashboard/ActivityFeed'
import { PageLoader } from '../components/shared/Loader'
import SegmentedSearchSelect from '../components/shared/SegmentedSearchSelect'
import PageHeader from '../components/shared/PageHeader'

const EMPTY_FILTERS = { operation: '', division: '', region: '', area: '', branchCode: '', category: '', dateStart: '', dateEnd: '' }

export default function Dashboard() {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const { data: dash, isLoading } = useDashboard()
  const { data: staff = [] } = useStaff()
  const { data: branches = [] } = useBranches()
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
    if (['it','at','comms'].includes(record._type)) return String(record.branch_code || '').trim().toUpperCase()
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
          const s = new Date(filters.dateStart); s.setHours(0,0,0,0)
          const e = new Date(filters.dateEnd);   e.setHours(23,59,59,999)
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

  const today = new Date().toLocaleDateString('en-PH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
  const selectOptions = (items) => items.map(item => ({ value: item, label: item }))
  const openDashboardReport = (key) => {
    const statusMap = { pending: 'Pending', approved: 'Checked', rejected: 'Rejected' }
    const params = new URLSearchParams()
    if (statusMap[key]) params.set('status', statusMap[key])
    navigate(`/reports${params.toString() ? `?${params.toString()}` : ''}`)
  }

  if (isLoading) return <PageLoader />

  return (
    <div>
      <PageHeader
        eyebrow="Operations overview"
        title={`Good day, ${user?.full_name?.split(',')[0] || 'Team'}`}
        subtitle="Monitor requests, approvals, and operational activity in one place."
        icon="fa-chart-line"
        actions={<span className="text-sm font-semibold text-slate-500 dark:text-slate-400"><i className="far fa-calendar-alt mr-2 text-blue-500" />{today}</span>}
      />

      {/* Task alert */}
      {(statsData.pending > 0) && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl p-3 flex items-center gap-3 mb-4">
          <div className="w-9 h-9 bg-amber-500 rounded-xl flex items-center justify-center flex-shrink-0">
            <i className="fas fa-bell text-white text-sm" />
          </div>
          <div className="flex-1">
            <div className="font-semibold text-sm text-amber-800 dark:text-amber-200">Action Required</div>
            <div className="text-xs text-amber-600 dark:text-amber-400">You have {statsData.pending} request(s) awaiting your action.</div>
          </div>
        </div>
      )}

      {/* Dashboard Filters */}
      <div className="card relative z-30 overflow-visible p-4 mb-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div><h2 className="text-sm font-extrabold text-slate-900 dark:text-white">Filter overview</h2><p className="text-xs text-slate-500 dark:text-slate-400">Refine the dashboard without losing context.</p></div>
          {activeFilters.length > 0 && <button onClick={() => setFilters(EMPTY_FILTERS)} className="text-xs font-bold text-blue-600 hover:text-blue-700 dark:text-sky-300">Clear all</button>}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
          <div>
            <label className="label">Date Start</label>
            <input type="date" className="input text-sm py-1.5" value={filters.dateStart} onChange={e => set('dateStart', e.target.value)} />
          </div>
          <div>
            <label className="label">Date End</label>
            <input type="date" className="input text-sm py-1.5" value={filters.dateEnd} onChange={e => set('dateEnd', e.target.value)} />
          </div>
          <div>
            <label className="label">Category</label>
            <select className="input text-sm py-1.5" value={filters.category} onChange={e => set('category', e.target.value)}>
              <option value="">All Categories</option>
              <option value="req">Request Letter</option>
              <option value="sbar">SBAR</option>
              <option value="it">IT Expenses</option>
              <option value="at">Aircon & Toilet</option>
              <option value="comms">Comms</option>
            </select>
          </div>
          <SegmentedSearchSelect label="Branch" value={filters.branchCode} options={geoOptions.branches} onChange={value => set('branchCode', value)} className="w-[260px]" />
        </div>
        <details className="mt-3 border-t border-slate-100 pt-3 dark:border-slate-800">
          <summary className="cursor-pointer text-xs font-bold text-slate-600 dark:text-slate-300">Advanced geographic filters <i className="fas fa-chevron-down ml-1 text-[9px]" /></summary>
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <SegmentedSearchSelect label="Operation" value={filters.operation} options={selectOptions(geoOptions.operations)} onChange={value => set('operation', value)} />
            <SegmentedSearchSelect label="Division" value={filters.division} options={selectOptions(geoOptions.divisions)} onChange={value => set('division', value)} />
            <SegmentedSearchSelect label="Region" value={filters.region} options={selectOptions(geoOptions.regions)} onChange={value => set('region', value)} />
            <SegmentedSearchSelect label="Area" value={filters.area} options={selectOptions(geoOptions.areas)} onChange={value => set('area', value)} />
          </div>
        </details>
        {activeFilters.length > 0 && <div className="mt-3 flex flex-wrap gap-2" aria-label="Active filters">{activeFilters.map(([key, value]) => <button key={key} onClick={() => set(key, '')} className="filter-chip"><span className="capitalize">{key.replace('branchCode', 'branch')}</span>: {value}<i className="fas fa-times" /></button>)}</div>}
      </div>

      {/* Stat Cards */}
      <StatCards data={statsData} onCardClick={openDashboardReport} />

      {/* Charts Row 1 + Activity Feed */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 mb-4">
        <div className="xl:col-span-2">
          <TrendChart data={combined} />
        </div>
        <div className="xl:row-span-2">
          <ActivityFeed combined={combined} />
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2">
          <StackedWeekChart data={combined} />
        </div>
        <div>
          <Insights data={statsData} combined={combined} />
        </div>
      </div>
    </div>
  )
}
