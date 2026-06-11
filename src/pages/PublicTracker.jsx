import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import SegmentedSearchSelect from '../components/shared/SegmentedSearchSelect'
import FilePreviewModal from '../components/shared/FilePreviewModal'
import { fetchAllBranches } from '../hooks/useBranches'

const TRACKER_ROWS_PER_PAGE = 100
const TRACKER_ENCODER_NAME = 'Mary Jane Cared Lapitan'
const TRACKER_REFRESH_MS = 5 * 60 * 1000

const SOURCES = [
  {
    key: 'requests',
    label: 'Request Letter',
    table: 'requests',
    id: 'req_id',
    date: 'date_req',
    select: '*',
    map: (row) => ({
      id: row.req_id,
      module: 'Request Letter',
      type: row.type || 'Request',
      party: row.beneficiary || '-',
      title: row.title || '-',
      description: row.description || '',
      date: row.date_req,
      amount: row.amount,
      status: row.status || 'Pending',
      file_id: row.file_id || '',
      branch_code: extractBranchCode(row.beneficiary),
      uploader: row.uploader || '-',
      created_at: row.created_at,
      updated_at: row.updated_at,
      remarks: row.remarks || '',
    }),
  },
  {
    key: 'sbar',
    label: 'SBAR / Transfer',
    table: 'sbar',
    id: 'uniq_id',
    date: 'date',
    select: '*',
    map: (row) => ({
      id: row.uniq_id,
      module: 'SBAR / Transfer',
      type: row.type || 'SBAR',
      party: `${row.giver || '-'} -> ${row.receiver || '-'}`,
      title: `${row.giver_title || '-'} -> ${row.receiver_title || '-'}`,
      description: row.description || '',
      date: row.date,
      amount: row.amount,
      status: row.status || 'Pending',
      file_id: row.file_id || '',
      branch_code: extractBranchCode(row.giver),
      uploader: row.uploader || '-',
      created_at: row.created_at,
      updated_at: row.updated_at,
      remarks: row.remarks || '',
    }),
  },
  {
    key: 'it',
    label: 'IT Expenses',
    table: 'it_expenses',
    id: 'uniq_id',
    date: 'date',
    select: '*',
    map: (row) => expenseRow(row, 'IT Expenses'),
  },
  {
    key: 'at',
    label: 'Aircon & Toilet',
    table: 'at_expenses',
    id: 'uniq_id',
    date: 'date',
    select: '*',
    map: (row) => expenseRow(row, 'Aircon & Toilet'),
  },
  {
    key: 'comms',
    label: 'Comms Expenses',
    table: 'comms_expenses',
    id: 'uniq_id',
    date: 'date',
    select: '*',
    map: (row) => expenseRow(row, 'Comms Expenses'),
  },
]

const STAGES = [
  { key: 'Pending', label: 'Pending For Recommendation of OPs Finance', tone: 'bg-amber-100 text-amber-700 border-amber-200' },
  { key: 'Checked', label: 'Already sent to Group Head', tone: 'bg-blue-100 text-blue-700 border-blue-200' },
  { key: 'Rejected', label: 'Rejected', tone: 'bg-red-100 text-red-700 border-red-200' },
]

const SENT_TO_VP_STATUSES = new Set([
  'Checked',
  'Recommended Ops Fin',
  'Pending For Recommendation of OPs Finance',
])

function expenseRow(row, module) {
  return {
    id: row.uniq_id,
    module,
    type: row.category || module,
    party: `${row.branch_code || '-'} - ${row.branch_name || '-'}`,
    title: row.account_title || row.item_name || row.category || '-',
    description: row.description || '',
    date: row.date,
    amount: row.amount,
    status: row.status || 'Pending',
    file_id: row.file_id || '',
    branch_code: row.branch_code || '',
    account_title: row.account_title || '',
    uploader: row.uploader || '-',
    created_at: row.created_at,
    updated_at: row.updated_at,
    remarks: row.remarks || '',
  }
}

function formatDate(value) {
  return value
    ? new Date(value).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' })
    : '-'
}

function formatCurrency(value) {
  const amount = Number(value || 0)
  return `PHP ${amount.toLocaleString('en-PH', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
}

function getStage(status) {
  if (status === 'Rejected') return 2
  if (SENT_TO_VP_STATUSES.has(status)) return 1
  return 0
}

function stageLabel(status) {
  return STAGES[getStage(status)]?.label || 'Received By Ops Fin'
}

function stageTone(status) {
  return STAGES[getStage(status)]?.tone || STAGES[0].tone
}

function TrackerRecordCard({ record, onPreview }) {
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{formatDate(record.date || record.created_at)}</p>
          <h3 className="mt-1 line-clamp-2 text-sm font-bold text-slate-950">{record.title}</h3>
          <p className="mt-1 truncate text-xs text-slate-500">{record.type}</p>
        </div>
        <span className={`max-w-[9.5rem] shrink-0 rounded-full border px-2.5 py-1 text-center text-[11px] font-bold leading-tight ${stageTone(record.status)}`}>
          {stageLabel(record.status)}
        </span>
      </div>

      <div className="mt-4 grid gap-3 text-sm">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Beneficiary / Branch</div>
          <div className="mt-0.5 break-words font-medium text-slate-800">{record.party}</div>
        </div>
        <div className="grid gap-3 rounded-lg bg-slate-50 p-3">
          <div className="flex items-center justify-between gap-3">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Amount</div>
            <div className="text-right font-bold text-slate-950">{formatCurrency(record.amount)}</div>
          </div>
          <div className="border-t border-slate-200 pt-3">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Encoded By</div>
            <div className="mt-0.5 break-words font-semibold leading-snug text-slate-800">{TRACKER_ENCODER_NAME}</div>
          </div>
        </div>
        <div className="flex items-center justify-between gap-3">
          {record.remarks ? (
            <div className="min-w-0 truncate text-xs font-semibold text-red-500">{record.remarks}</div>
          ) : (
            <span className="min-w-0" />
          )}
          {record.file_id ? (
            <button
              type="button"
              onClick={() => onPreview(record.file_id)}
              className="inline-flex h-9 items-center justify-center rounded-md bg-blue-600 px-3 text-xs font-bold text-white transition hover:bg-blue-500"
            >
              <i className="fas fa-eye mr-1" />
              Preview
            </button>
          ) : (
            <span className="pb-2 text-xs font-semibold text-slate-400">No file</span>
          )}
        </div>
      </div>
    </article>
  )
}

function extractBranchCode(value) {
  const match = String(value || '').trim().match(/^([A-Z0-9]+)\s*-/i)
  return match ? match[1].toUpperCase() : ''
}

export default function PublicTracker() {
  const [records, setRecords] = useState([])
  const [branches, setBranches] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [previewFile, setPreviewFile] = useState(null)
  const [page, setPage] = useState(1)
  const [filters, setFilters] = useState({
    search: '',
    module: 'All',
    dateFrom: '',
    dateTo: '',
    operation: 'All',
    division: 'All',
    region: 'All',
    area: 'All',
    branch: 'All',
  })

  useEffect(() => {
    let active = true

    async function loadTracker() {
      setLoading(true)
      setError('')
      try {
        const [sourceResults, branchRows, staffResult] = await Promise.all([
          Promise.all(SOURCES.map(async (source) => {
            const { data, error: sourceError } = await supabase
              .from(source.table)
              .select(source.select)
              .order('created_at', { ascending: false })

            if (sourceError) {
              console.warn(`Tracker skipped ${source.table}:`, sourceError.message)
              return []
            }
            return (data || []).map(source.map)
          })),
          fetchAllBranches().catch((branchError) => {
            console.warn('Tracker branch lookup skipped:', branchError.message)
            return []
          }),
          supabase.from('staff').select('*'),
        ])

        if (staffResult.error) console.warn('Tracker staff lookup skipped:', staffResult.error.message)

        const branchMap = Object.fromEntries(branchRows.map(branch => [String(branch.code || '').toUpperCase(), branch]))
        const staffMap = {}
        ;(staffResult.data || []).forEach((staff) => {
          const names = [
            staff.name,
            staff.full_name,
            `${staff.first_name || ''} ${staff.last_name || ''}`.trim(),
            `${staff.last_name || ''}, ${staff.first_name || ''}`.trim(),
          ].filter(Boolean)
          names.forEach(name => { staffMap[String(name).toLowerCase()] = staff.branch_code })
        })

        const enriched = sourceResults.flat().map((record) => {
          const staffBranchCode = record.module === 'Request Letter' && !record.branch_code
            ? staffMap[String(record.party || '').toLowerCase()]
            : ''
          const branchCode = String(record.branch_code || staffBranchCode || '').toUpperCase()
          const branch = branchMap[branchCode] || {}

          return {
            ...record,
            branch_code: branchCode,
            branch_name: branch.name || '',
            operation: branch.operation || '',
            division: branch.division || '',
            region: branch.region || '',
            area: branch.area || '',
          }
        })

        if (active) {
          setBranches(branchRows)
          setRecords(enriched.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0)))
        }
      } catch (err) {
        if (active) setError(err.message || 'Unable to load tracker.')
      } finally {
        if (active) setLoading(false)
      }
    }

    loadTracker()
    const interval = setInterval(loadTracker, TRACKER_REFRESH_MS)
    return () => {
      active = false
      clearInterval(interval)
    }
  }, [])

  const modules = useMemo(() => ['All', ...SOURCES.map(source => source.label)], [])
  const selectOptions = (items) => items.map(item => ({ value: item, label: item }))
  const geoOptions = useMemo(() => {
    const matches = (branch, ignoreKey = '') => {
      if (ignoreKey !== 'operation' && filters.operation !== 'All' && branch.operation !== filters.operation) return false
      if (ignoreKey !== 'division' && filters.division !== 'All' && branch.division !== filters.division) return false
      if (ignoreKey !== 'region' && filters.region !== 'All' && branch.region !== filters.region) return false
      if (ignoreKey !== 'area' && filters.area !== 'All' && branch.area !== filters.area) return false
      if (ignoreKey !== 'branch' && filters.branch !== 'All' && String(branch.code || '') !== filters.branch) return false
      return true
    }

    const optionsFor = (key) => [...new Set(
      branches
        .filter(branch => matches(branch, key))
        .map(branch => branch[key])
        .filter(Boolean)
    )].sort()

    const operations = optionsFor('operation')
    const divisions = optionsFor('division')
    const regions = optionsFor('region')
    const areas = optionsFor('area')
    const branchRows = branches.filter(branch => matches(branch, 'branch'))
    const branchOptions = branchRows
      .filter(branch => branch.code)
      .map(branch => ({ value: String(branch.code), label: `${branch.code} - ${branch.name || ''}` }))
      .sort((a, b) => a.label.localeCompare(b.label))

    return { operations, divisions, regions, areas, branchOptions }
  }, [branches, filters.operation, filters.division, filters.region, filters.area, filters.branch])

  const updateGeoFilter = (key, value) => {
    const nextValue = value || 'All'

    setFilters(prev => {
      if (key === 'branch') {
        const branch = branches.find(item => String(item.code || '') === nextValue)
        if (!branch || nextValue === 'All') return { ...prev, branch: 'All' }

        return {
          ...prev,
          operation: branch.operation || 'All',
          division: branch.division || 'All',
          region: branch.region || 'All',
          area: branch.area || 'All',
          branch: String(branch.code || ''),
        }
      }

      const next = { ...prev, [key]: nextValue, branch: 'All' }
      const geoKeys = ['operation', 'division', 'region', 'area']

      const getCompatibleBranches = (filtersToCheck) => branches.filter(branch => (
        geoKeys.every(item => filtersToCheck[item] === 'All' || branch[item] === filtersToCheck[item])
      ))

      let compatibleBranches = getCompatibleBranches(next)

      geoKeys.forEach(item => {
        if (next[item] === 'All') return

        const stillValid = compatibleBranches.some(branch => branch[item] === next[item])
        if (!stillValid) {
          next[item] = 'All'
          compatibleBranches = getCompatibleBranches(next)
        }
      })

      geoKeys.forEach(item => {
        if (next[item] !== 'All') return

        const values = [...new Set(compatibleBranches.map(branch => branch[item]).filter(Boolean))]
        if (values.length === 1) next[item] = values[0]
      })

      return next
    })
  }

  const filtered = useMemo(() => {
    const needle = filters.search.trim().toLowerCase()
    const from = filters.dateFrom ? new Date(filters.dateFrom) : null
    const to = filters.dateTo ? new Date(filters.dateTo) : null
    if (to) to.setHours(23, 59, 59, 999)
    return records.filter((record) => {
      const haystack = `${record.id} ${record.module} ${record.type} ${record.party} ${record.title} ${record.description} ${record.uploader}`.toLowerCase()
      const date = record.date ? new Date(record.date) : null

      if (needle && !haystack.includes(needle)) return false
      if (filters.module !== 'All' && record.module !== filters.module) return false
      if (filters.operation !== 'All' && record.operation !== filters.operation) return false
      if (filters.division !== 'All' && record.division !== filters.division) return false
      if (filters.region !== 'All' && record.region !== filters.region) return false
      if (filters.area !== 'All' && record.area !== filters.area) return false
      if (filters.branch !== 'All' && String(record.branch_code || '') !== filters.branch) return false
      if (from && (!date || date < from)) return false
      if (to && (!date || date > to)) return false
      return true
    })
  }, [records, filters])

  useEffect(() => {
    setPage(1)
  }, [filters])

  const totalPages = Math.max(1, Math.ceil(filtered.length / TRACKER_ROWS_PER_PAGE))
  const safePage = Math.min(page, totalPages)
  const pageStart = (safePage - 1) * TRACKER_ROWS_PER_PAGE
  const pageEnd = Math.min(pageStart + TRACKER_ROWS_PER_PAGE, filtered.length)
  const paged = filtered.slice(pageStart, pageEnd)

  const totals = useMemo(() => {
    const base = {
      amount: filtered.reduce((sum, row) => sum + Number(row.amount || 0), 0),
      Pending: 0,
      Checked: 0,
      Rejected: 0,
    }

    filtered.forEach((row) => {
      if (row.status === 'Rejected') base.Rejected += 1
      else if (SENT_TO_VP_STATUSES.has(row.status)) base.Checked += 1
      else base.Pending += 1
    })

    return base
  }, [filtered])

  const resetFilters = () => setFilters({
    search: '',
    module: 'All',
    dateFrom: '',
    dateTo: '',
    operation: 'All',
    division: 'All',
    region: 'All',
    area: 'All',
    branch: 'All',
  })

  return (
    <div className="min-h-screen overflow-x-hidden bg-slate-100 text-slate-900">
      <header className="border-b border-slate-200 bg-slate-50">
        <div className="mx-auto max-w-[1500px] px-3 py-3 sm:px-6 sm:py-4">
          <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm sm:p-5">
            <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center">
              <div className="min-w-0">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white shadow-sm sm:h-11 sm:w-11">
                    <i className="fas fa-route" />
                  </div>
                  <div className="min-w-0">
                    <h1 className="mt-0.5 text-xl font-bold tracking-tight text-slate-950 sm:text-2xl">Request Letter Tracker</h1>
                  </div>
                </div>
              </div>

              <div className="grid min-w-0 gap-2 sm:grid-cols-2 lg:grid-cols-5 xl:w-[900px]">
                <Link
                  to="/"
                  className="inline-flex min-w-0 items-center justify-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2.5 text-sm font-bold text-blue-700 transition hover:bg-blue-100"
                >
                  <i className="fas fa-home text-xs" />
                  <span>Home</span>
                </Link>
                <div className="flex min-w-0 items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-white text-slate-600 ring-1 ring-slate-200">
                    <i className="fas fa-list text-xs" />
                  </span>
                  <div className="min-w-0">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Records</div>
                    <div className="truncate text-lg font-bold text-slate-950">{filtered.length}</div>
                  </div>
                </div>
                <div className="flex min-w-0 items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-white text-amber-600 ring-1 ring-amber-200">
                    <i className="fas fa-clock text-xs" />
                  </span>
                  <div className="min-w-0">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-amber-700">Pending For Recommendation of OPs Fin</div>
                    <div className="truncate text-lg font-bold text-amber-700">{totals.Pending}</div>
                  </div>
                </div>
                <div className="flex min-w-0 items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2.5">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-white text-blue-600 ring-1 ring-blue-200">
                    <i className="fas fa-check text-xs" />
                  </span>
                  <div className="min-w-0">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-blue-700">Already sent to Group Head</div>
                    <div className="truncate text-lg font-bold text-blue-700">{totals.Checked}</div>
                  </div>
                </div>
                <div className="flex min-w-0 items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-white text-emerald-600 ring-1 ring-emerald-200">
                    <i className="fas fa-peso-sign text-xs" />
                  </span>
                  <div className="min-w-0">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700">Total</div>
                    <div className="truncate text-base font-bold text-slate-950" title={formatCurrency(totals.amount)}>{formatCurrency(totals.amount)}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1500px] px-3 py-4 sm:px-6 sm:py-6">
        <section className="mb-4 overflow-visible rounded-lg border border-slate-200 bg-white p-3 shadow-sm sm:mb-5 sm:p-4">
          <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0" />
            <button className="btn-secondary w-full justify-center whitespace-nowrap sm:w-auto" onClick={resetFilters}>
              <i className="fas fa-rotate-left mr-1" />
              Clear
            </button>
          </div>
          <div className="grid min-w-0 gap-2.5 sm:grid-cols-2 sm:gap-3 xl:grid-cols-[1.7fr_repeat(3,minmax(120px,1fr))]">
            <input
              className="input min-w-0 sm:col-span-2 xl:col-span-1"
              placeholder="Search reference, branch, beneficiary, item, uploader..."
              value={filters.search}
              onChange={e => setFilters(prev => ({ ...prev, search: e.target.value }))}
            />
            <select className="input min-w-0" value={filters.module} onChange={e => setFilters(prev => ({ ...prev, module: e.target.value }))}>
              {modules.map(module => <option key={module}>{module}</option>)}
            </select>
            <input type="date" className="input min-w-0" value={filters.dateFrom} onChange={e => setFilters(prev => ({ ...prev, dateFrom: e.target.value }))} />
            <input type="date" className="input min-w-0" value={filters.dateTo} onChange={e => setFilters(prev => ({ ...prev, dateTo: e.target.value }))} />
          </div>
          <div className="mt-2.5 grid min-w-0 gap-2.5 sm:mt-3 sm:grid-cols-2 sm:gap-3 lg:grid-cols-3 xl:grid-cols-5">
            <SegmentedSearchSelect
              label="Operation"
              value={filters.operation === 'All' ? '' : filters.operation}
              options={selectOptions(geoOptions.operations)}
              onChange={value => updateGeoFilter('operation', value)}
              className="w-full min-w-0"
            />
            <SegmentedSearchSelect
              label="Division"
              value={filters.division === 'All' ? '' : filters.division}
              options={selectOptions(geoOptions.divisions)}
              onChange={value => updateGeoFilter('division', value)}
              className="w-full min-w-0"
            />
            <SegmentedSearchSelect
              label="Region"
              value={filters.region === 'All' ? '' : filters.region}
              options={selectOptions(geoOptions.regions)}
              onChange={value => updateGeoFilter('region', value)}
              className="w-full min-w-0"
            />
            <SegmentedSearchSelect
              label="Area"
              value={filters.area === 'All' ? '' : filters.area}
              options={selectOptions(geoOptions.areas)}
              onChange={value => updateGeoFilter('area', value)}
              className="w-full min-w-0"
            />
            <SegmentedSearchSelect
              label="Branch"
              value={filters.branch === 'All' ? '' : filters.branch}
              options={geoOptions.branchOptions}
              onChange={value => updateGeoFilter('branch', value)}
              className="w-full min-w-0 sm:col-span-2 lg:col-span-1"
            />
          </div>
        </section>

        <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50/70 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <h2 className="font-bold text-slate-950">Requests</h2>
              <p className="text-xs text-slate-500">
                {filtered.length ? `Showing ${pageStart + 1}-${pageEnd} of ${filtered.length}` : '0 records shown'}
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs font-semibold">
              <span className="rounded-md bg-red-50 px-2 py-1 text-red-600">Rejected: {totals.Rejected}</span>
              <span className="rounded-md bg-slate-100 px-2 py-1 text-slate-600">Auto-refresh: 5 min</span>
            </div>
          </div>

          {error && <div className="m-4 border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}

          <div className="grid gap-3 bg-slate-50 p-3 md:hidden">
            {loading ? (
              <div className="rounded-lg border border-slate-200 bg-white p-5 text-center text-sm text-slate-400">Loading tracker...</div>
            ) : filtered.length === 0 ? (
              <div className="rounded-lg border border-slate-200 bg-white p-5 text-center text-sm text-slate-400">No records found.</div>
            ) : paged.map((record) => (
              <TrackerRecordCard
                key={`${record.module}-${record.id}`}
                record={record}
                onPreview={setPreviewFile}
              />
            ))}
          </div>

          <div className="hidden max-h-[68vh] overflow-auto md:block">
            <table className="w-full min-w-[1180px] table-fixed">
              <thead className="sticky top-0 z-10 bg-white">
                <tr>
                  <th className="table-th w-32">Date</th>
                  <th className="table-th w-56">Type / Title</th>
                  <th className="table-th w-64">Beneficiary / Branch</th>
                  <th className="table-th w-32">Amount</th>
                  <th className="table-th w-52">Tracker Status</th>
                  <th className="table-th w-48">Encoded By</th>
                  <th className="table-th w-32">Attachment</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td className="table-td text-center text-slate-400" colSpan={7}>Loading tracker...</td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td className="table-td text-center text-slate-400" colSpan={7}>No records found.</td>
                  </tr>
                ) : paged.map((record, index) => (
                  <tr
                    key={`${record.module}-${record.id}`}
                    className={`table-tr ${index % 2 === 0 ? 'bg-white' : 'bg-slate-50/80'} hover:bg-blue-50/70`}
                  >
                    <td className="table-td whitespace-nowrap">{formatDate(record.date || record.created_at)}</td>
                    <td className="table-td min-w-0">
                      <div className="font-semibold truncate" title={record.title}>{record.title}</div>
                      <div className="text-xs text-slate-400 truncate" title={record.type}>{record.type}</div>
                    </td>
                    <td className="table-td truncate" title={record.party}>{record.party}</td>
                    <td className="table-td font-semibold whitespace-nowrap">{formatCurrency(record.amount)}</td>
                    <td className="table-td">
                      <div className={`inline-flex max-w-full rounded-full border px-3 py-1 text-center text-xs font-bold leading-tight ${stageTone(record.status)}`}>
                        {stageLabel(record.status)}
                      </div>
                    </td>
                    <td className="table-td font-semibold leading-snug text-slate-700" title={TRACKER_ENCODER_NAME}>{TRACKER_ENCODER_NAME}</td>
                    <td className="table-td">
                      {record.file_id ? (
                        <button
                          type="button"
                          onClick={() => setPreviewFile(record.file_id)}
                          className="inline-flex items-center justify-center rounded-md bg-blue-600 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-blue-500"
                        >
                          <i className="fas fa-eye mr-1" />
                          Preview
                        </button>
                      ) : (
                        <span className="text-xs text-slate-400">No file</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-white px-4 py-3">
            <div className="text-xs font-semibold text-slate-500">
              Page {safePage} of {totalPages}
            </div>
            <div className="flex items-center gap-2">
              <button
                className="btn-secondary px-3 py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-50"
                disabled={safePage <= 1}
                onClick={() => setPage(current => Math.max(1, current - 1))}
              >
                Prev
              </button>
              <button
                className="btn-secondary px-3 py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-50"
                disabled={safePage >= totalPages}
                onClick={() => setPage(current => Math.min(totalPages, current + 1))}
              >
                Next
              </button>
            </div>
          </div>
        </section>
      </main>
      {previewFile && <FilePreviewModal fileId={previewFile} onClose={() => setPreviewFile(null)} />}
    </div>
  )
}
