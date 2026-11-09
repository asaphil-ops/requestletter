import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import PageHeader from '../components/shared/PageHeader'
import { TableLoader } from '../components/shared/Loader'
import {
  isPhotocopyCorRecord,
  useComplianceCertificates,
  useTransmittals,
} from '../hooks/useCompliance'
import { useBranches } from '../hooks/useBranches'
import { getAddressMatch } from './ComplianceCertificates'

const compact = (val) => String(val ?? '').trim()

const MONTH_NAMES = [
  'JANUARY',
  'FEBRUARY',
  'MARCH',
  'APRIL',
  'MAY',
  'JUNE',
  'JULY',
  'AUGUST',
  'SEPTEMBER',
  'OCTOBER',
  'NOVEMBER',
  'DECEMBER',
]

const STANDARD_OPERATIONS = [
  'Luzon I',
  'Luzon II',
  'Luzon III',
  'Luzon IV',
  'VISAYAS I',
  'VISAYAS II',
  'MINDANAO I',
  'MINDANAO II',
  'IMF',
]

export function extractDateInfo(rawValue) {
  if (!rawValue) return null
  const text = String(rawValue).trim()
  if (!text) return null

  const isoMatch = text.match(/\b(20\d{2})[-/](0?[1-9]|1[0-2])[-/](0?[1-9]|[12]\d|3[01])\b/)
  if (isoMatch) {
    const year = Number(isoMatch[1])
    const month = Number(isoMatch[2]) - 1
    const day = Number(isoMatch[3])
    const d = new Date(year, month, day)
    return {
      date: d,
      iso: `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
      year,
      month,
    }
  }

  const mdyMatch = text.match(/\b(0?[1-9]|1[0-2])[-/](0?[1-9]|[12]\d|3[01])[-/](20\d{2})\b/)
  if (mdyMatch) {
    const month = Number(mdyMatch[1]) - 1
    const day = Number(mdyMatch[2])
    const year = Number(mdyMatch[3])
    const d = new Date(year, month, day)
    return {
      date: d,
      iso: `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
      year,
      month,
    }
  }

  const monthTokens = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
  const lower = text.toLowerCase()
  for (let m = 0; m < 12; m++) {
    const re = new RegExp(
      `\\b${monthTokens[m]}[a-z]*\\b(?:[\\s,.-]+(\\d{1,2}))?(?:[\\s,.-]+(20\\d{2}))?`,
      'i'
    )
    const match = lower.match(re)
    if (match) {
      const day = match[1] ? Number(match[1]) : 1
      const year = match[2] ? Number(match[2]) : new Date().getFullYear()
      const d = new Date(year, m, day)
      return {
        date: d,
        iso: `${year}-${String(m + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
        year,
        month: m,
      }
    }
  }

  const parsed = new Date(text)
  if (!Number.isNaN(parsed.getTime()) && parsed.getFullYear() >= 2000 && parsed.getFullYear() <= 2100) {
    const year = parsed.getFullYear()
    const month = parsed.getMonth()
    const day = parsed.getDate()
    return {
      date: parsed,
      iso: `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
      year,
      month,
    }
  }

  return null
}

function classifyBirRow(row) {
  const remarks = compact(row.remarks).toLowerCase()
  const match = getAddressMatch(row, 'cor')
  const hasCorAddress = !match.status.startsWith('No ')
  const hasCorLink = Boolean(compact(row.cor_link))

  if (/\b(same\s*office|same\s*bldg|same\s*building)\b/i.test(remarks)) {
    return 'same_office'
  }
  if (/\b(on\s*process|in\s*process|processing|for\s*bir|pending\s*bir|transmittal)\b/i.test(remarks)) {
    return 'on_process'
  }
  if (isPhotocopyCorRecord(row)) {
    return 'wo_original'
  }
  if (!hasCorAddress) {
    return 'no_cor'
  }
  if (!hasCorLink && /\b(no\s*file|missing\s*orig)\b/i.test(remarks)) {
    return 'wo_original'
  }
  return 'with_original'
}

function classifySatelliteRemark(remarksRaw) {
  const r = compact(remarksRaw).toLowerCase()
  if (!r || r === 'no cor' || r === 'no cor address recorded' || r === '-' || r === 'n/a') {
    return 'No COR (unspecified)'
  }
  if (/\b(verif|for\s*verification|to\s*verify)\b/i.test(r)) {
    return 'For Verification'
  }
  if (/\b(10\s*km|more\s*than\s*10|>\s*10)\b/i.test(r)) {
    return 'No COR – More than 10 km'
  }
  if (/\b(same\s*house|same\s*office|same\s*bldg|same\s*building)\b/i.test(r)) {
    return 'Same House'
  }
  if (/\b(3\s*km|within\s*3|<\s*3)\b/i.test(r)) {
    return 'No COR – 3 km'
  }
  return 'Other Remarks'
}

export default function ComplianceDashboard() {
  const { data: corRows = [], isLoading: corLoading } = useComplianceCertificates('cor')
  const { data: transmittals = [], isLoading: trnLoading } = useTransmittals()
  const { data: branches = [] } = useBranches()

  // Date & Geo Filters
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [selectedYear, setSelectedYear] = useState('')
  const [selectedMonth, setSelectedMonth] = useState('')
  const [operationFilter, setOperationFilter] = useState('')
  const [appTypeFilter, setAppTypeFilter] = useState('')

  const branchGeoMap = useMemo(() => {
    const map = new Map()
    branches.forEach((b) => {
      if (b.code) {
        map.set(String(b.code).trim().toUpperCase(), b)
      }
    })
    return map
  }, [branches])

  const availableYears = useMemo(() => {
    const years = new Set([new Date().getFullYear()])
    corRows.forEach((r) => {
      const info = extractDateInfo(r.updated_at || r.created_at)
      if (info?.year) years.add(info.year)
    })
    transmittals.forEach((r) => {
      ;[r.date_received_lbc, r.date_submitted_bir, r.claimed_from_bir, r.updated_at, r.created_at].forEach(
        (val) => {
          const info = extractDateInfo(val)
          if (info?.year) years.add(info.year)
        }
      )
    })
    return [...years].sort((a, b) => b - a)
  }, [corRows, transmittals])

  const operationsList = useMemo(() => {
    const dynamic = branches.map((b) => compact(b.operation)).filter(Boolean)
    const merged = [...STANDARD_OPERATIONS]
    dynamic.forEach((op) => {
      if (!merged.some((std) => std.toLowerCase() === op.toLowerCase())) {
        merged.push(op)
      }
    })
    return merged
  }, [branches])

  const matchesDateFilter = (dateInfo) => {
    if (!dateFrom && !dateTo && !selectedYear && selectedMonth === '') return true
    if (!dateInfo) return false
    if (selectedYear && String(dateInfo.year) !== String(selectedYear)) return false
    if (selectedMonth !== '' && Number(dateInfo.month) !== Number(selectedMonth)) return false
    if (dateFrom && dateInfo.iso < dateFrom) return false
    if (dateTo && dateInfo.iso > dateTo) return false
    return true
  }

  // Enrich COR rows with Branch Geo & Date filtering
  const filteredCorRows = useMemo(() => {
    return corRows
      .map((r) => {
        const code = compact(r.branch_code).toUpperCase()
        const geo = branchGeoMap.get(code)
        return {
          ...r,
          operation: geo?.operation || r.operation || '',
          division: geo?.division || '',
          region: geo?.region || '',
          area: geo?.area || '',
          branch_address: geo?.address || '',
        }
      })
      .filter((r) => {
        if (
          operationFilter &&
          compact(r.operation).toLowerCase() !== compact(operationFilter).toLowerCase()
        ) {
          return false
        }
        if (dateFrom || dateTo || selectedYear || selectedMonth !== '') {
          const rowDate = extractDateInfo(r.updated_at || r.created_at)
          if (!matchesDateFilter(rowDate)) return false
        }
        return true
      })
  }, [corRows, branchGeoMap, operationFilter, dateFrom, dateTo, selectedYear, selectedMonth])

  // Enrich Transmittal rows with Branch Geo & Filters
  const filteredTransmittals = useMemo(() => {
    return transmittals
      .map((r) => {
        const code = compact(r.branch_code).toUpperCase()
        const geo = branchGeoMap.get(code)
        return {
          ...r,
          operation: geo?.operation || r.operation || '',
        }
      })
      .filter((r) => {
        if (
          operationFilter &&
          compact(r.operation).toLowerCase() !== compact(operationFilter).toLowerCase()
        ) {
          return false
        }
        if (
          appTypeFilter &&
          compact(r.type_of_application).toLowerCase() !== compact(appTypeFilter).toLowerCase()
        ) {
          return false
        }
        if (dateFrom || dateTo || selectedYear || selectedMonth !== '') {
          const anyDate =
            extractDateInfo(r.date_received_lbc) ||
            extractDateInfo(r.date_submitted_bir) ||
            extractDateInfo(r.claimed_from_bir) ||
            extractDateInfo(r.updated_at || r.created_at)
          if (!matchesDateFilter(anyDate)) return false
        }
        return true
      })
  }, [
    transmittals,
    branchGeoMap,
    operationFilter,
    appTypeFilter,
    dateFrom,
    dateTo,
    selectedYear,
    selectedMonth,
  ])

  // 1. SUMMARY OF BIR Registration & CAMS Monitoring
  const birSummary = useMemo(() => {
    const initBucket = () => ({
      total: 0,
      with_original: 0,
      wo_original: 0,
      no_cor: 0,
      same_office: 0,
      on_process: 0,
    })
    const branchesBucket = initBucket()
    const satelliteBucket = initBucket()

    let camsMatch = 0
    let camsUnmatch = 0
    let branchAddrMatch = 0
    let branchAddrUnmatch = 0

    filteredCorRows.forEach((row) => {
      const isSat = compact(row.branch_type).toLowerCase().includes('satellite')
      const target = isSat ? satelliteBucket : branchesBucket
      const category = classifyBirRow(row)

      target.total += 1
      target[category] += 1

      const match = getAddressMatch(row, 'cor')
      if (match.status === 'Matched') {
        camsMatch += 1
      } else {
        camsUnmatch += 1
      }

      if (compact(row.cor_address) && compact(row.cams_address)) {
        if (match.status === 'Matched') branchAddrMatch += 1
        else branchAddrUnmatch += 1
      }
    })

    const totalPoints = {
      total: branchesBucket.total + satelliteBucket.total,
      with_original: branchesBucket.with_original + satelliteBucket.with_original,
      wo_original: branchesBucket.wo_original + satelliteBucket.wo_original,
      no_cor: branchesBucket.no_cor + satelliteBucket.no_cor,
      same_office: branchesBucket.same_office + satelliteBucket.same_office,
      on_process: branchesBucket.on_process + satelliteBucket.on_process,
    }

    const pct = (val) =>
      totalPoints.total > 0 ? `${((val / totalPoints.total) * 100).toFixed(2)}%` : '0.00%'

    return {
      branches: branchesBucket,
      satellite: satelliteBucket,
      total: totalPoints,
      percentages: {
        with_original: pct(totalPoints.with_original),
        wo_original: pct(totalPoints.wo_original),
        no_cor: pct(totalPoints.no_cor),
        same_office: pct(totalPoints.same_office),
        on_process: pct(totalPoints.on_process),
      },
      camsMonitoring: {
        camsMatch,
        camsUnmatch,
        branchAddrMatch,
        branchAddrUnmatch,
        total: totalPoints.total,
      },
    }
  }, [filteredCorRows])

  // 2. Satellites Without COR (by Operation) & Summary by Remarks Category
  const satelliteBreakdown = useMemo(() => {
    const byOperationMap = new Map()
    operationsList.forEach((op) => {
      byOperationMap.set(op.toLowerCase(), {
        label: op,
        satelliteNoCor: 0,
        motherWoOrigCor: 0,
      })
    })

    const remarksCounts = {
      'For Verification': 0,
      'No COR (unspecified)': 0,
      'No COR – More than 10 km': 0,
      'Same House': 0,
      'No COR – 3 km': 0,
      'Other Remarks': 0,
    }

    filteredCorRows.forEach((row) => {
      const isSat = compact(row.branch_type).toLowerCase().includes('satellite')
      const category = classifyBirRow(row)
      const match = getAddressMatch(row, 'cor')
      const isNoCor = match.status.startsWith('No ') || category === 'no_cor'

      const opRaw = compact(row.operation) || 'Unassigned'
      const opKey = opRaw.toLowerCase()

      if (!byOperationMap.has(opKey) && (isNoCor || category === 'wo_original')) {
        byOperationMap.set(opKey, {
          label: opRaw,
          satelliteNoCor: 0,
          motherWoOrigCor: 0,
        })
      }

      if (isSat && isNoCor) {
        const entry = byOperationMap.get(opKey)
        if (entry) entry.satelliteNoCor += 1

        const remCat = classifySatelliteRemark(row.remarks)
        remarksCounts[remCat] = (remarksCounts[remCat] || 0) + 1
      } else if (!isSat && (isNoCor || category === 'wo_original')) {
        const entry = byOperationMap.get(opKey)
        if (entry) entry.motherWoOrigCor += 1
      }
    })

    const operationRows = [...byOperationMap.values()]
    const totalSatNoCor = operationRows.reduce((s, r) => s + r.satelliteNoCor, 0)
    const totalMotherWoCor = operationRows.reduce((s, r) => s + r.motherWoOrigCor, 0)
    const totalRemarksCount = Object.values(remarksCounts).reduce((s, v) => s + v, 0)

    return {
      operationRows,
      totalSatNoCor,
      totalMotherWoCor,
      remarksCounts,
      totalRemarksCount,
    }
  }, [filteredCorRows, operationsList])

  // 3. TRANSMITTAL Monthly Matrix (Jan - Dec + Total)
  const transmittalMatrix = useMemo(() => {
    const received = Array(12).fill(0)
    const submitted = Array(12).fill(0)
    const claimed = Array(12).fill(0)
    const dispatched = Array(12).fill(0)

    filteredTransmittals.forEach((row) => {
      const rcvInfo = extractDateInfo(row.date_received_lbc)
      const subInfo = extractDateInfo(row.date_submitted_bir)
      const clmText = compact(row.claimed_from_bir)
      const clmInfo =
        extractDateInfo(clmText) ||
        (clmText && !/^(pending|no|none|-|unclaimed)$/i.test(clmText)
          ? subInfo || rcvInfo || extractDateInfo(row.updated_at || row.created_at)
          : null)

      const hasDispatch =
        Boolean(compact(row.cor_link)) ||
        /\b(dispatch|dispatched|sent|released\s*to\s*branch)\b/i.test(
          `${row.claimed_from_bir || ''} ${row.remarks_in_charge || ''}`
        )
      const dispInfo = hasDispatch
        ? clmInfo || subInfo || rcvInfo || extractDateInfo(row.updated_at || row.created_at)
        : null

      if (rcvInfo && matchesDateFilter(rcvInfo)) {
        received[rcvInfo.month] += 1
      }
      if (subInfo && matchesDateFilter(subInfo)) {
        submitted[subInfo.month] += 1
      }
      if (clmInfo && matchesDateFilter(clmInfo)) {
        claimed[clmInfo.month] += 1
      }
      if (dispInfo && matchesDateFilter(dispInfo)) {
        dispatched[dispInfo.month] += 1
      }
    })

    const sum = (arr) => arr.reduce((a, b) => a + b, 0)

    return [
      { label: 'REQUEST RECEIVED', months: received, total: sum(received), tone: 'text-slate-800' },
      { label: 'SUBMITTED TO BIR', months: submitted, total: sum(submitted), tone: 'text-sky-700' },
      { label: 'CLAIMED FROM BIR', months: claimed, total: sum(claimed), tone: 'text-indigo-700' },
      {
        label: 'DISPATCH TO BRANCHES',
        months: dispatched,
        total: sum(dispatched),
        tone: 'text-emerald-700',
      },
    ]
  }, [filteredTransmittals, dateFrom, dateTo, selectedYear, selectedMonth])

  const resetFilters = () => {
    setDateFrom('')
    setDateTo('')
    setSelectedYear('')
    setSelectedMonth('')
    setOperationFilter('')
    setAppTypeFilter('')
  }

  const hasFilters = Boolean(
    dateFrom || dateTo || selectedYear || selectedMonth !== '' || operationFilter || appTypeFilter
  )

  return (
    <div className="space-y-5">
      <PageHeader
        title="Compliance Dashboard"
        subtitle="Summary of BIR Registration, CAMS Address Monitoring, Satellites Without COR, and Monthly Transmittal Tracker."
        icon="fa-chart-pie"
        actions={
          <>
            <Link to="/compliance/transmittal" className="btn-secondary text-xs">
              <i className="fas fa-truck-fast text-indigo-600" /> Open Transmittal
            </Link>
            <Link to="/compliance/cor" className="btn-secondary text-xs">
              <i className="fas fa-certificate text-teal-600" /> Open COR Certification
            </Link>
            <Link to="/compliance/satellite-no-cor" className="btn-secondary text-xs">
              <i className="fas fa-satellite-dish text-rose-600" /> Satellite with No COR
            </Link>
          </>
        }
      />

      {/* Date & Operation Filter Bar */}
      <div className="card p-4">
        <div className="flex flex-wrap items-center gap-2.5">
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            title="Date From"
            className="input h-10 w-[142px] py-1.5 text-xs font-semibold"
          />
          <span className="text-xs font-semibold text-gray-400">to</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            title="Date To"
            className="input h-10 w-[142px] py-1.5 text-xs font-semibold"
          />
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
            className="input h-10 w-[115px] py-1.5 text-xs font-semibold"
          >
            <option value="">All Years</option>
            {availableYears.map((yr) => (
              <option key={yr} value={yr}>
                {yr}
              </option>
            ))}
          </select>
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="input h-10 w-[135px] py-1.5 text-xs font-semibold"
          >
            <option value="">All Months</option>
            {MONTH_NAMES.map((m, idx) => (
              <option key={m} value={idx}>
                {m}
              </option>
            ))}
          </select>
          <select
            value={operationFilter}
            onChange={(e) => setOperationFilter(e.target.value)}
            className="input h-10 w-auto min-w-[160px] py-1.5 text-xs font-semibold"
          >
            <option value="">All Operations</option>
            {operationsList.map((op) => (
              <option key={op} value={op}>
                {op}
              </option>
            ))}
          </select>
          <select
            value={appTypeFilter}
            onChange={(e) => setAppTypeFilter(e.target.value)}
            className="input h-10 w-auto min-w-[180px] py-1.5 text-xs font-semibold"
          >
            <option value="">All Application Types</option>
            <option value="New COR">New COR</option>
            <option value="Update Address">Update Address</option>
            <option value="COR Replacement">COR Replacement</option>
          </select>
          <button
            type="button"
            onClick={resetFilters}
            disabled={!hasFilters}
            className="btn-secondary h-10 text-xs px-3.5 whitespace-nowrap disabled:opacity-60"
          >
            <i className="fas fa-sync-alt mr-1.5" />Reset Filters
          </button>
        </div>
      </div>

      {corLoading || trnLoading ? (
        <div className="card p-4">
          <table className="w-full">
            <tbody>
              <TableLoader cols={7} rows={6} />
            </tbody>
          </table>
        </div>
      ) : (
        <>
          {/* SECTION 1: SUMMARY OF BIR REGISTRATION */}
          <div className="card overflow-hidden">
            <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <i className="fas fa-certificate text-teal-400" />
                <h3 className="text-xs font-black uppercase tracking-wider">
                  Summary of BIR Registration
                </h3>
              </div>
              <span className="text-[11px] text-slate-300 font-semibold">
                Total Service Points: {birSummary.total.total}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 font-black border-b border-slate-200 text-center">
                    <th className="py-3 px-4 text-left w-[210px] border-r border-slate-200">
                      Service Point Type
                    </th>
                    <th className="py-3 px-4 border-r border-slate-200">Number of Branches</th>
                    <th className="py-3 px-4 border-r border-slate-200 text-emerald-700">
                      With Original COR
                    </th>
                    <th className="py-3 px-4 border-r border-slate-200 text-amber-700">
                      W/O Original COR
                    </th>
                    <th className="py-3 px-4 border-r border-slate-200 text-rose-700">No COR</th>
                    <th className="py-3 px-4 border-r border-slate-200 text-indigo-700">
                      Same Office
                    </th>
                    <th className="py-3 px-4 text-sky-700">On Process</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-center">
                  <tr className="hover:bg-slate-50/80">
                    <td className="py-3 px-4 text-left font-bold text-slate-800 border-r border-slate-200">
                      Branches
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-800 border-r border-slate-200">
                      {birSummary.branches.total}
                    </td>
                    <td className="py-3 px-4 font-semibold text-emerald-700 border-r border-slate-200">
                      {birSummary.branches.with_original}
                    </td>
                    <td className="py-3 px-4 font-semibold text-amber-700 border-r border-slate-200">
                      {birSummary.branches.wo_original || ''}
                    </td>
                    <td className="py-3 px-4 font-semibold text-rose-700 border-r border-slate-200">
                      {birSummary.branches.no_cor || ''}
                    </td>
                    <td className="py-3 px-4 font-semibold text-indigo-700 border-r border-slate-200">
                      {birSummary.branches.same_office || ''}
                    </td>
                    <td className="py-3 px-4 font-semibold text-sky-700">
                      {birSummary.branches.on_process || ''}
                    </td>
                  </tr>

                  <tr className="hover:bg-slate-50/80">
                    <td className="py-3 px-4 text-left font-bold text-slate-800 border-r border-slate-200">
                      Satellite
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-800 border-r border-slate-200">
                      {birSummary.satellite.total}
                    </td>
                    <td className="py-3 px-4 font-semibold text-emerald-700 border-r border-slate-200">
                      {birSummary.satellite.with_original}
                    </td>
                    <td className="py-3 px-4 font-semibold text-amber-700 border-r border-slate-200">
                      {birSummary.satellite.wo_original || ''}
                    </td>
                    <td className="py-3 px-4 font-semibold text-rose-700 border-r border-slate-200">
                      {birSummary.satellite.no_cor || ''}
                    </td>
                    <td className="py-3 px-4 font-semibold text-indigo-700 border-r border-slate-200">
                      {birSummary.satellite.same_office || ''}
                    </td>
                    <td className="py-3 px-4 font-semibold text-sky-700">
                      {birSummary.satellite.on_process || ''}
                    </td>
                  </tr>

                  <tr className="bg-slate-50 font-black text-slate-900">
                    <td className="py-3 px-4 text-left border-r border-slate-200">
                      Total Service Points
                    </td>
                    <td className="py-3 px-4 border-r border-slate-200">
                      {birSummary.total.total}
                    </td>
                    <td className="py-3 px-4 text-emerald-800 border-r border-slate-200">
                      {birSummary.total.with_original}
                    </td>
                    <td className="py-3 px-4 text-amber-800 border-r border-slate-200">
                      {birSummary.total.wo_original}
                    </td>
                    <td className="py-3 px-4 text-rose-800 border-r border-slate-200">
                      {birSummary.total.no_cor}
                    </td>
                    <td className="py-3 px-4 text-indigo-800 border-r border-slate-200">
                      {birSummary.total.same_office}
                    </td>
                    <td className="py-3 px-4 text-sky-800">{birSummary.total.on_process}</td>
                  </tr>

                  <tr className="bg-slate-100/70 font-black text-slate-700">
                    <td className="py-2.5 px-4 text-left border-r border-slate-200 text-[11px] text-slate-500">
                      Percentage Share
                    </td>
                    <td className="py-2.5 px-4 border-r border-slate-200" />
                    <td className="py-2.5 px-4 text-emerald-700 border-r border-slate-200">
                      {birSummary.percentages.with_original}
                    </td>
                    <td className="py-2.5 px-4 text-amber-700 border-r border-slate-200">
                      {birSummary.percentages.wo_original}
                    </td>
                    <td className="py-2.5 px-4 text-rose-700 border-r border-slate-200">
                      {birSummary.percentages.no_cor}
                    </td>
                    <td className="py-2.5 px-4 text-indigo-700 border-r border-slate-200">
                      {birSummary.percentages.same_office}
                    </td>
                    <td className="py-2.5 px-4 text-sky-700">
                      {birSummary.percentages.on_process}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* SECTION 2: FOR CAMS UPDATE MONITORING */}
          <div className="card overflow-hidden">
            <div className="px-5 py-3.5 bg-slate-800 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <i className="fas fa-map-location-dot text-sky-400" />
                <h3 className="text-xs font-black uppercase tracking-wider">
                  For CAMS Update Monitoring
                </h3>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse text-center">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 font-black border-b border-slate-200">
                    <th className="py-3.5 px-4 text-left w-[240px] border-r border-slate-200">
                      FOR CAMS UPDATE MONITORING
                    </th>
                    <th className="py-3.5 px-4 border-r border-slate-200 text-emerald-700">
                      Match Address CAMS vs COR
                    </th>
                    <th className="py-3.5 px-4 border-r border-slate-200 text-rose-700">
                      Unmatch Address CAMS vs COR
                    </th>
                    <th className="py-3.5 px-4 border-r border-slate-200 text-teal-700">
                      Match COR Address vs Branch Address
                    </th>
                    <th className="py-3.5 px-4 border-r border-slate-200 text-amber-700">
                      Unmatch COR Address vs Branch Address
                    </th>
                    <th className="py-3.5 px-4 text-slate-900">TOTAL</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="hover:bg-slate-50 font-black text-sm">
                    <td className="py-4 px-4 text-left text-xs font-bold text-slate-600 border-r border-slate-200">
                      Count Across Service Points
                    </td>
                    <td className="py-4 px-4 text-emerald-700 border-r border-slate-200">
                      {birSummary.camsMonitoring.camsMatch}
                    </td>
                    <td className="py-4 px-4 text-rose-700 border-r border-slate-200">
                      {birSummary.camsMonitoring.camsUnmatch}
                    </td>
                    <td className="py-4 px-4 text-teal-700 border-r border-slate-200">
                      {birSummary.camsMonitoring.branchAddrMatch || ''}
                    </td>
                    <td className="py-4 px-4 text-amber-700 border-r border-slate-200">
                      {birSummary.camsMonitoring.branchAddrUnmatch || ''}
                    </td>
                    <td className="py-4 px-4 text-slate-900 bg-slate-50">
                      {birSummary.camsMonitoring.total}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* SECTION 3: SATELLITES WITHOUT COR (BY OPERATION & BY REMARKS CATEGORY) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Left: Satellites Without COR by Operation */}
            <div className="card overflow-hidden">
              <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <i className="fas fa-satellite-dish text-rose-400" />
                  <h3 className="text-xs font-black uppercase tracking-wider">
                    Satellites Without COR
                  </h3>
                </div>
                <span className="text-[11px] text-rose-300 font-bold">
                  Total: {satelliteBreakdown.totalSatNoCor}
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse text-center">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700 font-black border-b border-slate-200">
                      <th className="py-2.5 px-4 text-left border-r border-slate-200">
                        Operation
                      </th>
                      <th className="py-2.5 px-4 border-r border-slate-200 text-rose-700">
                        Satellite W/O COR
                      </th>
                      <th className="py-2.5 px-4 text-amber-700">Mother W/O Orig COR</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {satelliteBreakdown.operationRows.map((row) => (
                      <tr key={row.label} className="hover:bg-slate-50">
                        <td className="py-2.5 px-4 text-left font-semibold text-slate-800 border-r border-slate-200">
                          {row.label}
                        </td>
                        <td className="py-2.5 px-4 font-bold text-slate-800 border-r border-slate-200">
                          {row.satelliteNoCor}
                        </td>
                        <td className="py-2.5 px-4 font-bold text-slate-700">
                          {row.motherWoOrigCor}
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-slate-100 font-black text-slate-900">
                      <td className="py-3 px-4 text-left border-r border-slate-200">Total</td>
                      <td className="py-3 px-4 text-rose-700 border-r border-slate-200">
                        {satelliteBreakdown.totalSatNoCor}
                      </td>
                      <td className="py-3 px-4 text-amber-700">
                        {satelliteBreakdown.totalMotherWoCor}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Right: Summary for Satellite without COR (Remarks Category) */}
            <div className="card overflow-hidden flex flex-col">
              <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <i className="fas fa-list-check text-amber-400" />
                  <h3 className="text-xs font-black uppercase tracking-wider">
                    Summary for Satellite without COR
                  </h3>
                </div>
                <span className="text-[11px] text-amber-300 font-bold">
                  Total: {satelliteBreakdown.totalRemarksCount}
                </span>
              </div>

              <div className="overflow-x-auto flex-1">
                <table className="w-full text-xs border-collapse text-center">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700 font-black border-b border-slate-200">
                      <th className="py-2.5 px-4 text-left border-r border-slate-200">
                        Remarks Category
                      </th>
                      <th className="py-2.5 px-4 w-[140px]">Count</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {Object.entries(satelliteBreakdown.remarksCounts).map(([category, count]) => (
                      <tr key={category} className="hover:bg-slate-50">
                        <td className="py-3 px-4 text-left font-semibold text-slate-800 border-r border-slate-200">
                          {category}
                        </td>
                        <td className="py-3 px-4 font-bold text-slate-800">{count}</td>
                      </tr>
                    ))}
                    <tr className="bg-slate-100 font-black text-slate-900">
                      <td className="py-3 px-4 text-left border-r border-slate-200">Total</td>
                      <td className="py-3 px-4 text-rose-700">
                        {satelliteBreakdown.totalRemarksCount}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* SECTION 4: TRANSMITTAL MONTHLY MATRIX (JAN - DEC + TOTAL) */}
          <div className="card overflow-hidden">
            <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <i className="fas fa-truck-fast text-indigo-400" />
                <h3 className="text-xs font-black uppercase tracking-wider">
                  Transmittal Monthly Summary{' '}
                  {selectedYear ? `(${selectedYear})` : '(All Recorded Dates)'}
                </h3>
              </div>
              <Link
                to="/compliance/transmittal"
                className="text-[11px] font-bold text-indigo-300 hover:text-white transition"
              >
                Manage Transmittals <i className="fas fa-arrow-right ml-1" />
              </Link>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[1150px] text-xs border-collapse text-center">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 font-black border-b border-slate-200 text-[11px]">
                    <th className="py-3 px-4 text-left w-[200px] border-r border-slate-200">
                      TRANSMITTAL
                    </th>
                    {MONTH_NAMES.map((m) => (
                      <th key={m} className="py-3 px-2.5 border-r border-slate-200">
                        {m}
                      </th>
                    ))}
                    <th className="py-3 px-3.5 bg-slate-200/70 text-slate-900">TOTAL</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {transmittalMatrix.map((row) => (
                    <tr key={row.label} className="hover:bg-slate-50">
                      <td
                        className={`py-3 px-4 text-left font-black border-r border-slate-200 ${row.tone}`}
                      >
                        {row.label}
                      </td>
                      {row.months.map((val, mIdx) => (
                        <td
                          key={mIdx}
                          className={`py-3 px-2.5 border-r border-slate-200 font-semibold ${
                            val > 0 ? 'text-slate-800' : 'text-slate-400'
                          }`}
                        >
                          {val}
                        </td>
                      ))}
                      <td className="py-3 px-3.5 font-black text-slate-900 bg-slate-50">
                        {row.total}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

