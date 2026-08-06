import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { fetchAllPages } from '../lib/supabasePagination'
import SegmentedSearchSelect from '../components/shared/SegmentedSearchSelect'
import FilePreviewModal from '../components/shared/FilePreviewModal'
import { branchCodesMatch, cleanGeoValue, fetchAllBranches, getBranchCodeAliases } from '../hooks/useBranches'
import { getDriveViewUrl, sortByLatest } from '../lib/utils'
import { syncRequestTrackerToGoogleSheet } from '../lib/gas'
import { logAudit } from '../lib/audit'
import Swal from 'sweetalert2'

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
      <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase text-slate-400">{formatDate(record.date || record.created_at)}</p>
          <h3 className="mt-1 line-clamp-2 text-base font-bold text-slate-950">{record.title}</h3>
          <p className="mt-1 truncate text-xs font-semibold text-slate-500">{record.type}</p>
        </div>
        <span className={`max-w-[10rem] shrink-0 rounded-md border px-2.5 py-1 text-center text-[11px] font-bold leading-tight ${stageTone(record.status)}`}>
          {stageLabel(record.status)}
        </span>
      </div>

      <div className="mt-3 grid gap-3 text-sm">
        <div>
          <div className="text-[11px] font-bold uppercase text-slate-400">Beneficiary / Branch</div>
          <div className="mt-0.5 break-words font-medium text-slate-800">{record.party}</div>
        </div>
        <div>
          <div className="text-[11px] font-bold uppercase text-slate-400">Description / Remarks</div>
          <div className="mt-0.5 whitespace-pre-wrap break-words text-slate-700">
            {[record.description, record.remarks].filter(Boolean).join(' — ') || '-'}
          </div>
        </div>
        <div className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <div className="flex items-center justify-between gap-3">
            <div className="text-[11px] font-bold uppercase text-slate-400">Amount</div>
            <div className="text-right font-bold text-slate-950">{formatCurrency(record.amount)}</div>
          </div>
          <div className="border-t border-slate-200 pt-3">
            <div className="text-[11px] font-bold uppercase text-slate-400">Encoded By</div>
            <div className="mt-0.5 break-words font-semibold leading-snug text-slate-800">{TRACKER_ENCODER_NAME}</div>
          </div>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="min-w-0" />
          {record.file_id ? (
            <button
              type="button"
              onClick={() => onPreview(record.file_id)}
              className="inline-flex h-9 items-center justify-center rounded-md bg-slate-900 px-3 text-xs font-bold text-white transition hover:bg-slate-700"
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

const normalizeGeo = (value) => cleanGeoValue(value).toLowerCase()
const geoMatches = (left, right) => normalizeGeo(left) === normalizeGeo(right)

export default function PublicTracker() {
  const [records, setRecords] = useState([])
  const [branches, setBranches] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [previewFile, setPreviewFile] = useState(null)
  const [page, setPage] = useState(1)
  const [isSyncingSheet, setIsSyncingSheet] = useState(false)
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
            try {
              const data = await fetchAllPages(() => supabase
                  .from(source.table)
                  .select(source.select)
                  .order('created_at', { ascending: false })
              )
              return (data || []).map(source.map)
            } catch (sourceError) {
              console.warn(`Tracker skipped ${source.table}:`, sourceError.message)
              return []
            }
          })),
          fetchAllBranches().catch((branchError) => {
            console.warn('Tracker branch lookup skipped:', branchError.message)
            return []
          }),
          fetchAllPages(() => supabase.from('staff').select('*')).then(data => ({ data })).catch(error => ({ error, data: [] })),
        ])

        if (staffResult.error) console.warn('Tracker staff lookup skipped:', staffResult.error.message)

        const branchMap = {}
        branchRows.forEach(branch => {
          getBranchCodeAliases(branch.code).forEach(alias => { branchMap[alias] = branch })
        })
        const staffMap = {}
        ;(staffResult.data || []).forEach((staff) => {
          const names = [
            staff.name,
            staff.full_name,
            `${staff.first_name || ''} ${staff.last_name || ''}`.trim(),
            `${staff.last_name || ''}, ${staff.first_name || ''}`.trim(),
          ].filter(Boolean)
          names.forEach(name => {
            staffMap[String(name).replace(/\s+/g, ' ').trim().toLowerCase()] = staff.branch_code
          })
        })

        const enriched = sourceResults.flat().map((record) => {
          const staffBranchCode = record.module === 'Request Letter' && !record.branch_code
            ? staffMap[String(record.party || '').replace(/\s+/g, ' ').trim().toLowerCase()]
            : ''
          const branchCode = String(record.branch_code || staffBranchCode || '').toUpperCase()
          const branch = getBranchCodeAliases(branchCode).map(alias => branchMap[alias]).find(Boolean) || {}

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
      if (ignoreKey !== 'operation' && filters.operation !== 'All' && !geoMatches(branch.operation, filters.operation)) return false
      if (ignoreKey !== 'division' && filters.division !== 'All' && !geoMatches(branch.division, filters.division)) return false
      if (ignoreKey !== 'region' && filters.region !== 'All' && !geoMatches(branch.region, filters.region)) return false
      if (ignoreKey !== 'area' && filters.area !== 'All' && !geoMatches(branch.area, filters.area)) return false
      if (ignoreKey !== 'branch' && filters.branch !== 'All' && !branchCodesMatch(branch.code, filters.branch)) return false
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
        const branch = branches.find(item => branchCodesMatch(item.code, nextValue))
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
        geoKeys.every(item => filtersToCheck[item] === 'All' || geoMatches(branch[item], filtersToCheck[item]))
      ))

      let compatibleBranches = getCompatibleBranches(next)

      geoKeys.forEach(item => {
        if (next[item] === 'All') return

        const stillValid = compatibleBranches.some(branch => geoMatches(branch[item], next[item]))
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
    const matches = records.filter((record) => {
      const haystack = `${record.id} ${record.module} ${record.type} ${record.party} ${record.title} ${record.description} ${record.uploader}`.toLowerCase()
      const date = record.date ? new Date(record.date) : null

      if (needle && !haystack.includes(needle)) return false
      if (filters.module !== 'All' && record.module !== filters.module) return false
      if (filters.operation !== 'All' && !geoMatches(record.operation, filters.operation)) return false
      if (filters.division !== 'All' && !geoMatches(record.division, filters.division)) return false
      if (filters.region !== 'All' && !geoMatches(record.region, filters.region)) return false
      if (filters.area !== 'All' && !geoMatches(record.area, filters.area)) return false
      if (filters.branch !== 'All' && !branchCodesMatch(record.branch_code, filters.branch)) return false
      if (from && (!date || date < from)) return false
      if (to && (!date || date > to)) return false
      return true
    })
    return sortByLatest(matches)
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

  const sendAllToGoogleSheet = async () => {
    if (!records.length) return Swal.fire('Nothing to send', 'The tracker has no records.', 'info')

    const rows = [
      ['Reference', 'Module', 'Date', 'Type', 'Title', 'Beneficiary / Branch', 'Description', 'Amount', 'Tracker Status', 'Encoded By', 'Remarks', 'Attachment Link'],
      ...sortByLatest(records).map(record => [
        record.id || '',
        record.module || '',
        record.date || record.created_at || '',
        record.type || '',
        record.title || '',
        record.party || '',
        record.description || '',
        Number(record.amount || 0),
        stageLabel(record.status),
        TRACKER_ENCODER_NAME,
        record.remarks || '',
        getDriveViewUrl(record.file_id) || '',
      ]),
    ]

    const confirmation = await Swal.fire({
      title: 'Replace Google Sheet data?',
      html: `<div style="text-align:left;font-size:14px"><p><b>Destination:</b> Request Letter Tracker</p><p><b>Records:</b> ${records.length}</p><p style="color:#b45309;margin-top:12px">The live sheet changes only after every batch is uploaded successfully.</p></div>`,
      icon: 'warning', showCancelButton: true, confirmButtonText: 'Replace and sync', cancelButtonText: 'Cancel',
    })
    if (!confirmation.isConfirmed) return

    try {
      setIsSyncingSheet(true)
      Swal.fire({
        title: 'Sending to Google Sheet...',
        text: `Preparing ${records.length} tracker record(s).`,
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading(),
      })
      const result = await syncRequestTrackerToGoogleSheet(rows, {
        onProgress: ({ batch, totalBatches, sent, total }) => Swal.update({ text: `Batch ${batch} of ${totalBatches} — ${Math.min(sent - 1, records.length)} of ${Math.max(total - 1, 0)} records` }),
      })
      await logAudit({ user: { full_name: TRACKER_ENCODER_NAME }, action: 'GOOGLE_SHEET_SYNC_SUCCESS', module: 'public_tracker', details: `${result.rowCount} records synced to ${result.sheetName}` })
      await Swal.fire({
        title: 'Google Sheet updated',
        text: `${result.rowCount} tracker record(s) were sent successfully.`,
        icon: 'success',
        showCancelButton: true,
        confirmButtonText: 'Open Google Sheet',
        cancelButtonText: 'Close',
      }).then(({ isConfirmed }) => {
        if (isConfirmed) window.open(result.spreadsheetUrl, '_blank', 'noopener,noreferrer')
      })
    } catch (err) {
      await logAudit({ user: { full_name: TRACKER_ENCODER_NAME }, action: 'GOOGLE_SHEET_SYNC_FAILED', module: 'public_tracker', details: err.message || 'Unknown sync error' })
      Swal.fire('Send failed', err.message || 'Unable to update the Google Sheet.', 'error')
    } finally {
      setIsSyncingSheet(false)
    }
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-slate-100 text-slate-900">
      <header className="relative overflow-hidden border-b border-slate-800 bg-slate-950 text-white shadow-lg">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.22),transparent_35%),radial-gradient(circle_at_left,rgba(14,165,233,0.15),transparent_30%)]" />
        <div className="relative mx-auto max-w-[1500px] px-4 py-6 sm:px-6 lg:py-7">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-3">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-500 text-xl text-white shadow-lg shadow-emerald-950/30 ring-1 ring-white/20">
                  <i className="fas fa-route" />
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-300">Operations Finance</p>
                  <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">Request Letter Tracker</h1>
                  <p className="mt-1 text-sm text-slate-400">Central monitoring for requests, recommendations, and releases</p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={loading || isSyncingSheet}
                onClick={sendAllToGoogleSheet}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-emerald-500 px-4 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <i className={`fas ${isSyncingSheet ? 'fa-spinner fa-spin' : 'fa-table'}`} />
                {isSyncingSheet ? 'Sending...' : 'Send to Google Sheet'}
              </button>
              <Link
                to="/"
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-white/15 bg-white/10 px-4 text-sm font-bold text-white transition hover:bg-white/15"
              >
                <i className="fas fa-home text-xs" />
                Home
              </Link>
              <button
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-white/15 bg-white/10 px-4 text-sm font-bold text-white transition hover:bg-white/15"
                onClick={resetFilters}
              >
                <i className="fas fa-rotate-left text-xs" />
                Clear
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1500px] px-4 py-6 sm:px-6">
        <section className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm ring-1 ring-slate-900/[0.02]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs font-bold uppercase text-slate-500">Records</div>
                <div className="mt-1 text-2xl font-bold text-slate-950">{filtered.length}</div>
              </div>
              <span className="flex h-10 w-10 items-center justify-center rounded-md bg-slate-100 text-slate-700">
                <i className="fas fa-list" />
              </span>
            </div>
          </div>
          <div className="rounded-xl border border-amber-200 bg-gradient-to-br from-amber-50 to-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs font-bold uppercase text-amber-700">Pending Ops Fin</div>
                <div className="mt-1 text-2xl font-bold text-amber-800">{totals.Pending}</div>
              </div>
              <span className="flex h-10 w-10 items-center justify-center rounded-md bg-white text-amber-700">
                <i className="fas fa-clock" />
              </span>
            </div>
          </div>
          <div className="rounded-xl border border-sky-200 bg-gradient-to-br from-sky-50 to-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs font-bold uppercase text-sky-700">Sent To Group Head</div>
                <div className="mt-1 text-2xl font-bold text-sky-800">{totals.Checked}</div>
              </div>
              <span className="flex h-10 w-10 items-center justify-center rounded-md bg-white text-sky-700">
                <i className="fas fa-paper-plane" />
              </span>
            </div>
          </div>
          <div className="rounded-xl border border-red-200 bg-gradient-to-br from-red-50 to-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs font-bold uppercase text-red-700">Rejected</div>
                <div className="mt-1 text-2xl font-bold text-red-800">{totals.Rejected}</div>
              </div>
              <span className="flex h-10 w-10 items-center justify-center rounded-md bg-white text-red-700">
                <i className="fas fa-circle-xmark" />
              </span>
            </div>
          </div>
          <div className="rounded-xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-4 shadow-sm sm:col-span-2 xl:col-span-1">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-xs font-bold uppercase text-emerald-700">Total Amount</div>
                <div className="mt-1 truncate text-xl font-bold text-slate-950" title={formatCurrency(totals.amount)}>{formatCurrency(totals.amount)}</div>
              </div>
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-white text-emerald-700">
                <i className="fas fa-peso-sign" />
              </span>
            </div>
          </div>
        </section>

        <section className="mb-5 overflow-visible rounded-xl border border-slate-200 bg-white shadow-sm ring-1 ring-slate-900/[0.02]">
          <div className="border-b border-slate-200 bg-slate-50/80 px-4 py-3">
            <div className="flex items-center gap-2">
              <i className="fas fa-filter text-slate-500" />
              <h2 className="text-sm font-bold text-slate-900">Filters</h2>
            </div>
          </div>
          <div className="p-4">
            <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-[1.7fr_repeat(3,minmax(120px,1fr))]">
              <div className="relative min-w-0 sm:col-span-2 xl:col-span-1">
                <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400" />
                <input
                  className="input min-w-0 pl-9"
                  placeholder="Search reference, branch, beneficiary, item, uploader..."
                  value={filters.search}
                  onChange={e => setFilters(prev => ({ ...prev, search: e.target.value }))}
                />
              </div>
              <select className="input min-w-0" value={filters.module} onChange={e => setFilters(prev => ({ ...prev, module: e.target.value }))}>
                {modules.map(module => <option key={module}>{module}</option>)}
              </select>
              <input type="date" className="input min-w-0" value={filters.dateFrom} onChange={e => setFilters(prev => ({ ...prev, dateFrom: e.target.value }))} />
              <input type="date" className="input min-w-0" value={filters.dateTo} onChange={e => setFilters(prev => ({ ...prev, dateTo: e.target.value }))} />
            </div>
            <div className="mt-3 grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
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
          </div>
        </section>

        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm ring-1 ring-slate-900/[0.02]">
          <div className="flex flex-col gap-3 border-b border-slate-200 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <h2 className="font-bold text-slate-950">Tracker Registry</h2>
              <p className="text-xs font-semibold text-slate-500">
                {filtered.length ? `Showing ${pageStart + 1}-${pageEnd} of ${filtered.length}` : '0 records shown'}
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs font-bold">
              <span className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-amber-700">Pending: {totals.Pending}</span>
              <span className="rounded-md border border-sky-200 bg-sky-50 px-2 py-1 text-sky-700">Sent: {totals.Checked}</span>
              <span className="rounded-md border border-red-200 bg-red-50 px-2 py-1 text-red-700">Rejected: {totals.Rejected}</span>
            </div>
          </div>

          {error && <div className="m-4 border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}

          <div className="grid gap-3 bg-[#f6f7f9] p-3 md:hidden">
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
            <table className="w-full min-w-[1420px] table-fixed">
              <thead className="sticky top-0 z-10 bg-slate-900 text-white shadow-sm">
                <tr>
                  <th className="table-th w-32">Date</th>
                  <th className="table-th w-56">Type / Title</th>
                  <th className="table-th w-64">Beneficiary / Branch</th>
                  <th className="table-th w-72">Description / Remarks</th>
                  <th className="table-th w-32">Amount</th>
                  <th className="table-th w-52">Tracker Status</th>
                  <th className="table-th w-48">Encoded By</th>
                  <th className="table-th w-32">Attachment</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td className="table-td text-center text-slate-400" colSpan={8}>Loading tracker...</td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td className="table-td text-center text-slate-400" colSpan={8}>No records found.</td>
                  </tr>
                ) : paged.map((record, index) => (
                  <tr
                    key={`${record.module}-${record.id}`}
                    className={`table-tr ${index % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'} hover:bg-emerald-50/60`}
                  >
                    <td className="table-td whitespace-nowrap font-semibold text-slate-700">{formatDate(record.date || record.created_at)}</td>
                    <td className="table-td min-w-0">
                      <div className="font-semibold truncate" title={record.title}>{record.title}</div>
                      <div className="text-xs text-slate-400 truncate" title={record.type}>{record.type}</div>
                    </td>
                    <td className="table-td truncate" title={record.party}>{record.party}</td>
                    <td className="table-td">
                      <div className="line-clamp-3 whitespace-pre-wrap text-sm text-slate-700" title={[record.description, record.remarks].filter(Boolean).join(' — ')}>
                        {[record.description, record.remarks].filter(Boolean).join(' — ') || '-'}
                      </div>
                    </td>
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
                          className="inline-flex items-center justify-center rounded-md bg-slate-900 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-slate-700"
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
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-4 py-3">
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
