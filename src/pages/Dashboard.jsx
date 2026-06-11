import { useState, useMemo } from 'react'
import { useAuthStore } from '../store/authStore'
import { useDashboard } from '../hooks/useDashboard'
import { useStaff, useStaffFilters } from '../hooks/useStaff'
import { useBranchOptions } from '../hooks/useBranches'
import StatCards from '../components/dashboard/StatCards'
import { TrendChart, CategoryChart, StackedWeekChart } from '../components/dashboard/Charts'
import Insights from '../components/dashboard/Insights'
import { PageLoader } from '../components/shared/Loader'
import SegmentedSearchSelect from '../components/shared/SegmentedSearchSelect'

const EMPTY_FILTERS = { operation: '', division: '', region: '', area: '', branchCode: '', category: '', dateStart: '', dateEnd: '' }

export default function Dashboard() {
  const { user } = useAuthStore()
  const { data: dash, isLoading } = useDashboard()
  const { data: staff = [] } = useStaff()
  const staffFilters = useStaffFilters()
  const branchOptions = useBranchOptions()
  const [filters, setFilters] = useState(EMPTY_FILTERS)

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

  // Cascading filter options
  const filteredStaff = useMemo(() => staff.filter(s =>
    (!filters.operation || s.operation === filters.operation) &&
    (!filters.division  || s.division  === filters.division)  &&
    (!filters.region    || s.region    === filters.region)     &&
    (!filters.area      || s.area      === filters.area)
  ), [staff, filters])

  const unique = (key) => [...new Set(filteredStaff.map(s => s[key]).filter(Boolean))].sort()
  const branchCodes = new Set(filteredStaff.map(s => s.branch_code).filter(Boolean))
  const filteredBranches = filters.operation
    ? branchOptions.filter(b => branchCodes.has(b.value))
    : branchOptions

  // Filter combined data
  const combined = useMemo(() => {
    if (!dash?.combined) return []
    return dash.combined.filter(r => {
      if (filters.category && r._type !== filters.category) return false
      if (filters.dateStart && filters.dateEnd) {
        try {
          const d = new Date(r.date || r.date_req || r.created_at)
          const s = new Date(filters.dateStart); s.setHours(0,0,0,0)
          const e = new Date(filters.dateEnd);   e.setHours(23,59,59,999)
          if (d < s || d > e) return false
        } catch {}
      }
      if (filters.branchCode || filters.operation || filters.division || filters.region || filters.area) {
        // For expenses: filter by bCode; for req/sbar: skip (no bCode)
        if (['it','at','comms'].includes(r._type)) {
          const code = (r.branch_code || '').trim().toUpperCase()
          if (filters.branchCode && code !== filters.branchCode) return false
        }
      }
      return true
    })
  }, [dash, filters])

  const filteredStaffCount = useMemo(() => {
    if (!filters.operation && !filters.division && !filters.region && !filters.area && !filters.branchCode) {
      return dash?.totalStaff || 0
    }
    return filteredStaff.filter(s => !filters.branchCode || s.branch_code === filters.branchCode).length
  }, [filteredStaff, filters, dash])

  const statsData = useMemo(() => {
    if (!combined.length && !dash) return {}
    const s = (status) => combined.filter(r => r.status === status).length
    return {
      totalStaff: filteredStaffCount,
      pending:    s('Pending'),
      checked:    s('Checked') + s('Approved'), // Combine 'Checked' and old 'Approved'
      rejected:   s('Rejected'),
      emailsSent: dash?.emailsSent || 0,
      totalReqs:  combined.length,
    }
  }, [combined, filteredStaffCount, dash])

  const today = new Date().toLocaleDateString('en-PH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
  const selectOptions = (items) => items.map(item => ({ value: item, label: item }))

  if (isLoading) return <PageLoader />

  return (
    <div>
      {/* Header */}
      <div className="flex items-end justify-between mb-4 flex-wrap gap-2">
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Overview</p>
          <h1 className="text-2xl font-extrabold text-gray-900 dark:text-gray-100">
            Good day, <span className="text-blue-600">{user?.full_name?.split(',')[0]}</span>
          </h1>
        </div>
        <span className="text-sm text-gray-400 flex items-center gap-2">
          <i className="far fa-calendar-alt text-blue-500" /> {today}
        </span>
      </div>

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
      <div className="card p-4 mb-5">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-9 gap-2 items-end">
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
          <SegmentedSearchSelect label="Operation" value={filters.operation} options={selectOptions(staffFilters.operations)} onChange={value => set('operation', value)} />
          <SegmentedSearchSelect label="Division" value={filters.division} options={selectOptions(unique('division'))} onChange={value => set('division', value)} />
          <SegmentedSearchSelect label="Region" value={filters.region} options={selectOptions(unique('region'))} onChange={value => set('region', value)} />
          <SegmentedSearchSelect label="Area" value={filters.area} options={selectOptions(unique('area'))} onChange={value => set('area', value)} />
          <SegmentedSearchSelect label="Branch" value={filters.branchCode} options={filteredBranches} onChange={value => set('branchCode', value)} className="w-[260px]" />
          <div className="flex items-end">
            <button onClick={() => setFilters(EMPTY_FILTERS)} className="btn-secondary w-full py-1.5 text-sm">
              <i className="fas fa-sync-alt mr-1" /> Reset
            </button>
          </div>
        </div>
      </div>

      {/* Stat Cards */}
      <StatCards data={statsData} />

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 mb-4">
        <div className="xl:col-span-2">
          <TrendChart data={combined} />
        </div>
        <div>
          <CategoryChart data={combined} />
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
