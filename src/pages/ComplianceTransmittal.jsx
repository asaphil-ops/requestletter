import { useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import Papa from 'papaparse'
import Swal from 'sweetalert2'
import PageHeader from '../components/shared/PageHeader'
import Pagination from '../components/shared/Pagination'
import { TableLoader } from '../components/shared/Loader'
import FilePreviewModal from '../components/shared/FilePreviewModal'
import TimelineModal from '../components/shared/TimelineModal'
import SegmentedSearchSelect from '../components/shared/SegmentedSearchSelect'
import {
  useTransmittals,
  useCreateTransmittal,
  useUpdateTransmittal,
  useDeleteTransmittal,
  useUpdateTransmittalFile,
  useBulkImportTransmittals,
} from '../hooks/useCompliance'
import { useBranches, useBranchEmailMap } from '../hooks/useBranches'
import { useAuthStore } from '../store/authStore'
import { useUIStore } from '../store/uiStore'
import { uploadToDrive } from '../lib/gas'
import { extractDateInfo } from './ComplianceDashboard'

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

const compact = (val) => String(val ?? '').trim()

const getDriveFileIdFromLink = (link) => {
  const value = String(link || '').trim()
  if (!value) return ''
  const filePathMatch = value.match(/\/file\/d\/([^/]+)/)
  if (filePathMatch?.[1]) return filePathMatch[1]
  const idMatch = value.match(/[?&]id=([^&]+)/)
  if (idMatch?.[1]) return idMatch[1]
  return value
}

const uploadTransmittalFile = async (file, branchCode = 'BRANCH') => {
  const ext = file.name.includes('.') ? `.${file.name.split('.').pop()}` : ''
  const cleanCode = String(branchCode || 'BRANCH').trim().toUpperCase()
  const renamed = new File([file], `${cleanCode}_TRANSMITTAL_COR${ext}`, { type: file.type })
  const res = await uploadToDrive(renamed, { convertToPdf: true })
  return res.url || (res.fileId ? `https://drive.google.com/file/d/${res.fileId}/view?usp=sharing` : '')
}

const EMPTY_FORM = {
  branch_code: '',
  branch_name: '',
  type_of_application: '',
  date_received_lbc: '',
  date_submitted_bir: '',
  remarks_in_charge: '',
  remarks_bir: '',
  claimed_from_bir: '',
  cor_link: '',
}

const APPLICATION_TYPE_OPTIONS = [
  'New COR',
  'Update Address',
  'COR Replacement',
]

export default function ComplianceTransmittal() {
  const { isAdmin, canEdit } = useAuthStore()
  const canManage = isAdmin || canEdit

  const { data: rows = [], isLoading } = useTransmittals()
  const { data: branches = [] } = useBranches()
  const branchEmailMap = useBranchEmailMap()
  const createMut = useCreateTransmittal()
  const updateMut = useUpdateTransmittal()
  const deleteMut = useDeleteTransmittal()
  const fileMut = useUpdateTransmittalFile()
  const bulkMut = useBulkImportTransmittals()

  const [search, setSearch] = useState('')
  const [appTypeFilter, setAppTypeFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [selectedYear, setSelectedYear] = useState('')
  const [selectedMonth, setSelectedMonth] = useState('')
  const [showDashboardTable, setShowDashboardTable] = useState(true)
  const [operation, setOperation] = useState('')
  const [division, setDivision] = useState('')
  const [region, setRegion] = useState('')
  const [area, setArea] = useState('')
  const [branchFilter, setBranchFilter] = useState('')
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(25)

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [uploadingField, setUploadingField] = useState(null)

  const [previewRecord, setPreviewRecord] = useState(null)
  const [detailEditMode, setDetailEditMode] = useState(false)
  const [detailForm, setDetailForm] = useState(EMPTY_FORM)
  const [detailReplacementFile, setDetailReplacementFile] = useState(null)
  const [savingDetailUpdate, setSavingDetailUpdate] = useState(false)

  const [previewFile, setPreviewFile] = useState(null)
  const [timelineId, setTimelineId] = useState(null)
  const [selectedIds, setSelectedIds] = useState([])

  // Bulk Import Modal state
  const [bulkOpen, setBulkOpen] = useState(false)
  const [bulkMode, setBulkMode] = useState('upsert')
  const [bulkRows, setBulkRows] = useState([])
  const [bulkFileName, setBulkFileName] = useState('')
  const bulkInputRef = useRef(null)

  // Quick row upload state
  const rowFileInputRef = useRef(null)
  const [uploadTarget, setUploadTarget] = useState(null)

  const branchGeoMap = useMemo(() => {
    const map = new Map()
    branches.forEach((b) => {
      if (b.code) {
        map.set(String(b.code).trim().toUpperCase(), b)
      }
    })
    return map
  }, [branches])

  const operations = useMemo(
    () => [...new Set(branches.map((b) => b.operation).filter(Boolean))].sort(),
    [branches]
  )
  const divisions = useMemo(() => {
    let list = branches
    if (operation) list = list.filter((b) => b.operation === operation)
    return [...new Set(list.map((b) => b.division).filter(Boolean))].sort()
  }, [branches, operation])
  const regions = useMemo(() => {
    let list = branches
    if (operation) list = list.filter((b) => b.operation === operation)
    if (division) list = list.filter((b) => b.division === division)
    return [...new Set(list.map((b) => b.region).filter(Boolean))].sort()
  }, [branches, operation, division])
  const areas = useMemo(() => {
    let list = branches
    if (operation) list = list.filter((b) => b.operation === operation)
    if (division) list = list.filter((b) => b.division === division)
    if (region) list = list.filter((b) => b.region === region)
    return [...new Set(list.map((b) => b.area).filter(Boolean))].sort()
  }, [branches, operation, division, region])

  const branchSelectOptions = useMemo(() => {
    let list = branches
    if (operation) list = list.filter((b) => b.operation === operation)
    if (division) list = list.filter((b) => b.division === division)
    if (region) list = list.filter((b) => b.region === region)
    if (area) list = list.filter((b) => b.area === area)
    return list
      .filter((b) => b.code)
      .sort((a, b) => a.code.localeCompare(b.code))
      .map((b) => ({
        value: b.code,
        label: `${b.code} - ${b.name || 'Unnamed Branch'}`,
      }))
  }, [branches, operation, division, region, area])

  const applicationTypeOptions = useMemo(() => {
    const dynamic = rows
      .map((r) => compact(r.type_of_application))
      .filter((v) => v && !APPLICATION_TYPE_OPTIONS.includes(v))
    return [...APPLICATION_TYPE_OPTIONS, ...new Set(dynamic)]
  }, [rows])

  const enrichedRows = useMemo(() => {
    return rows.map((r) => {
      const code = compact(r.branch_code).toUpperCase()
      const geo = branchGeoMap.get(code)
      return {
        ...r,
        branch_name: r.branch_name || geo?.name || '',
        area: geo?.area || '',
        region: geo?.region || '',
        division: geo?.division || '',
        operation: geo?.operation || '',
        email: geo?.email || '',
      }
    })
  }, [rows, branchGeoMap])

  const availableYears = useMemo(() => {
    const years = new Set([new Date().getFullYear()])
    rows.forEach((r) => {
      ;[r.date_received_lbc, r.date_submitted_bir, r.claimed_from_bir, r.updated_at, r.created_at].forEach(
        (val) => {
          const info = extractDateInfo(val)
          if (info?.year) years.add(info.year)
        }
      )
    })
    return [...years].sort((a, b) => b - a)
  }, [rows])

  const matchesDateFilter = (dateInfo) => {
    if (!dateFrom && !dateTo && !selectedYear && selectedMonth === '') return true
    if (!dateInfo) return false
    if (selectedYear && String(dateInfo.year) !== String(selectedYear)) return false
    if (selectedMonth !== '' && Number(dateInfo.month) !== Number(selectedMonth)) return false
    if (dateFrom && dateInfo.iso < dateFrom) return false
    if (dateTo && dateInfo.iso > dateTo) return false
    return true
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return enrichedRows.filter((r) => {
      if (operation && r.operation !== operation) return false
      if (division && r.division !== division) return false
      if (region && r.region !== region) return false
      if (area && r.area !== area) return false
      if (branchFilter && r.branch_code !== branchFilter) return false
      if (appTypeFilter && compact(r.type_of_application).toLowerCase() !== appTypeFilter.toLowerCase()) {
        return false
      }
      if (statusFilter === 'with_cor' && !compact(r.cor_link)) return false
      if (statusFilter === 'no_cor' && compact(r.cor_link)) return false
      if (statusFilter === 'claimed' && !compact(r.claimed_from_bir)) return false
      if (statusFilter === 'submitted' && !compact(r.date_submitted_bir)) return false
      if (statusFilter === 'pending_bir' && compact(r.date_submitted_bir)) return false

      if (dateFrom || dateTo || selectedYear || selectedMonth !== '') {
        const dateCandidates = [
          extractDateInfo(r.date_received_lbc),
          extractDateInfo(r.date_submitted_bir),
          extractDateInfo(r.claimed_from_bir),
          extractDateInfo(r.updated_at || r.created_at),
        ].filter(Boolean)
        if (!dateCandidates.some((d) => matchesDateFilter(d))) return false
      }

      if (!q) return true
      return [
        r.branch_code,
        r.branch_name,
        r.type_of_application,
        r.date_received_lbc,
        r.date_submitted_bir,
        r.remarks_in_charge,
        r.remarks_bir,
        r.claimed_from_bir,
        r.area,
        r.region,
      ].some((v) => String(v || '').toLowerCase().includes(q))
    })
  }, [
    enrichedRows,
    search,
    operation,
    division,
    region,
    area,
    branchFilter,
    appTypeFilter,
    statusFilter,
    dateFrom,
    dateTo,
    selectedYear,
    selectedMonth,
  ])

  const transmittalMonthlyMatrix = useMemo(() => {
    const received = Array(12).fill(0)
    const submitted = Array(12).fill(0)
    const claimed = Array(12).fill(0)
    const dispatched = Array(12).fill(0)

    filtered.forEach((row) => {
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

      if (rcvInfo && matchesDateFilter(rcvInfo)) received[rcvInfo.month] += 1
      if (subInfo && matchesDateFilter(subInfo)) submitted[subInfo.month] += 1
      if (clmInfo && matchesDateFilter(clmInfo)) claimed[clmInfo.month] += 1
      if (dispInfo && matchesDateFilter(dispInfo)) dispatched[dispInfo.month] += 1
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
  }, [filtered, dateFrom, dateTo, selectedYear, selectedMonth])

  const stats = useMemo(() => {
    const total = enrichedRows.length
    const receivedLbc = enrichedRows.filter((r) => Boolean(compact(r.date_received_lbc))).length
    const submittedBir = enrichedRows.filter((r) => Boolean(compact(r.date_submitted_bir))).length
    const claimedBir = enrichedRows.filter((r) => Boolean(compact(r.claimed_from_bir))).length
    const withCor = enrichedRows.filter((r) => Boolean(compact(r.cor_link))).length
    return { total, receivedLbc, submittedBir, claimedBir, withCor }
  }, [enrichedRows])

  const paged = useMemo(
    () => filtered.slice((page - 1) * perPage, page * perPage),
    [filtered, page, perPage]
  )

  const selectedRecords = useMemo(
    () => enrichedRows.filter((r) => selectedIds.includes(r.id)),
    [enrichedRows, selectedIds]
  )

  const isAllPagedSelected =
    paged.length > 0 && paged.every((r) => selectedIds.includes(r.id))

  const toggleSelectRow = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    )
  }

  const toggleSelectAllPaged = () => {
    const pagedIds = paged.map((r) => r.id)
    if (isAllPagedSelected) {
      setSelectedIds((prev) => prev.filter((id) => !pagedIds.includes(id)))
    } else {
      setSelectedIds((prev) => [...new Set([...prev, ...pagedIds])])
    }
  }

  const openDetails = (row) => {
    setPreviewRecord(row)
    setDetailEditMode(false)
    setDetailReplacementFile(null)
    setDetailForm({
      branch_code: row.branch_code || '',
      branch_name: row.branch_name || '',
      type_of_application: row.type_of_application || '',
      date_received_lbc: row.date_received_lbc || '',
      date_submitted_bir: row.date_submitted_bir || '',
      remarks_in_charge: row.remarks_in_charge || '',
      remarks_bir: row.remarks_bir || '',
      claimed_from_bir: row.claimed_from_bir || '',
      cor_link: row.cor_link || '',
    })
  }

  const handleSaveDetailUpdate = async (e) => {
    e.preventDefault()
    if (!previewRecord) return
    if (!compact(detailForm.branch_code)) {
      Swal.fire('Required', 'Branch Code is required.', 'warning')
      return
    }

    setSavingDetailUpdate(true)
    try {
      let nextLink = compact(detailForm.cor_link)
      if (detailReplacementFile) {
        const uploadedUrl = await uploadTransmittalFile(
          detailReplacementFile,
          detailForm.branch_code
        )
        if (uploadedUrl) {
          nextLink = uploadedUrl
        }
      }

      const updates = {
        ...detailForm,
        cor_link: nextLink,
      }

      await updateMut.mutateAsync({ id: previewRecord.id, updates })
      setPreviewRecord((prev) => (prev ? { ...prev, ...updates } : null))
      setDetailForm(updates)
      setDetailReplacementFile(null)
      setDetailEditMode(false)

      Swal.fire({
        icon: 'success',
        title: 'Transmittal Updated',
        text: 'Transmittal record has been saved and logged in History.',
        timer: 1800,
        showConfirmButton: false,
      })
    } catch (err) {
      Swal.fire('Error', err.message || 'Failed to update transmittal.', 'error')
    } finally {
      setSavingDetailUpdate(false)
    }
  }

  const openCreate = () => {
    setEditing(null)
    setForm(EMPTY_FORM)
    setModalOpen(true)
  }

  const openEdit = (row) => {
    setEditing(row)
    setForm({
      branch_code: row.branch_code || '',
      branch_name: row.branch_name || '',
      type_of_application: row.type_of_application || '',
      date_received_lbc: row.date_received_lbc || '',
      date_submitted_bir: row.date_submitted_bir || '',
      remarks_in_charge: row.remarks_in_charge || '',
      remarks_bir: row.remarks_bir || '',
      claimed_from_bir: row.claimed_from_bir || '',
      cor_link: row.cor_link || '',
    })
    setModalOpen(true)
  }

  const handleBranchSelect = (code) => {
    const found = branchGeoMap.get(String(code).trim().toUpperCase())
    setForm((f) => ({
      ...f,
      branch_code: code,
      branch_name: found?.name || f.branch_name,
    }))
  }

  const handleFormFileUpload = async (file) => {
    if (!file) return
    setUploadingField('cor_link')
    try {
      const url = await uploadTransmittalFile(file, form.branch_code || 'BRANCH')
      if (url) {
        setForm((f) => ({ ...f, cor_link: url }))
        Swal.fire({
          icon: 'success',
          title: 'COR File Uploaded',
          text: 'COR document uploaded and linked.',
          timer: 1400,
          showConfirmButton: false,
        })
      }
    } catch (err) {
      Swal.fire('Upload Failed', err.message || 'Could not upload file', 'error')
    } finally {
      setUploadingField(null)
    }
  }

  const handleSave = async (e) => {
    e.preventDefault()
    if (!compact(form.branch_code)) {
      Swal.fire('Required', 'Branch Code is required.', 'warning')
      return
    }
    try {
      if (editing) {
        await updateMut.mutateAsync({ id: editing.id, updates: form })
        Swal.fire({ icon: 'success', title: 'Updated!', timer: 1300, showConfirmButton: false })
      } else {
        await createMut.mutateAsync(form)
        Swal.fire({ icon: 'success', title: 'Added!', timer: 1300, showConfirmButton: false })
      }
      setModalOpen(false)
    } catch (err) {
      Swal.fire('Error', err.message || 'Failed to save transmittal record.', 'error')
    }
  }

  const handleDelete = async (row) => {
    const res = await Swal.fire({
      title: `Delete ${row.branch_code}?`,
      text: `Remove ${row.branch_name || row.branch_code} from Transmittal?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#e11d48',
      confirmButtonText: 'Delete',
    })
    if (!res.isConfirmed) return
    try {
      await deleteMut.mutateAsync(row)
      Swal.fire({ icon: 'success', title: 'Deleted', timer: 1200, showConfirmButton: false })
    } catch (err) {
      Swal.fire('Error', err.message, 'error')
    }
  }

  const triggerRowUpload = (row) => {
    setUploadTarget({ row })
    if (rowFileInputRef.current) {
      rowFileInputRef.current.value = ''
      rowFileInputRef.current.click()
    }
  }

  const handleRowFilePicked = async (e) => {
    const file = e.target.files?.[0]
    if (!file || !uploadTarget) return
    const { row } = uploadTarget
    try {
      Swal.fire({
        title: `Uploading COR for ${row.branch_code}...`,
        text: 'Saving file to Google Drive...',
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading(),
      })
      const link = await uploadTransmittalFile(file, row.branch_code)
      await fileMut.mutateAsync({ id: row.id, link })
      Swal.fire({ icon: 'success', title: 'Uploaded!', timer: 1400, showConfirmButton: false })
    } catch (err) {
      Swal.fire('Upload Error', err.message || 'Failed to upload file', 'error')
    } finally {
      setUploadTarget(null)
    }
  }

  const handleSendEmail = (row) => {
    if (!row) return
    const branchCode = String(row.branch_code || '').trim().toUpperCase()
    const opKey = String(row.operation || '').toUpperCase()
    const recipient = row.email || branchEmailMap[opKey] || branchEmailMap[branchCode]
    const branchLabel = [branchCode, compact(row.branch_name)].filter(Boolean).join(' - ') || 'Branch'
    const fileId = getDriveFileIdFromLink(row.cor_link)

    useUIStore.getState().openSendEmailModal({
      to: recipient ? [recipient] : [],
      subject: `${branchLabel} | BIR Transmittal (${row.type_of_application || 'Update'})`,
      messageBody: `Good day Ma'am/Sir,\n\nKindly see the BIR Transmittal update${
        fileId ? ' and attached COR file' : ''
      } for ${branchLabel}.`,
      refId: branchCode,
      refType: 'Transmittal',
      emailTitle: 'BIR Transmittal',
      fileId: fileId || '',
      fileName: `${branchCode} ${compact(row.branch_name)} - COR`.trim(),
      allowNoAttachment: true,
      emailDetails: {
        title: 'Transmittal Details',
        reference: branchLabel,
        status: compact(row.claimed_from_bir) || 'In Progress',
        rows: [
          ['Branch', branchLabel],
          ['Type of Application', compact(row.type_of_application)],
          ['Date Received (LBC)', compact(row.date_received_lbc)],
          ['Date Submitted to BIR', compact(row.date_submitted_bir)],
          ['Remarks from In Charge', compact(row.remarks_in_charge)],
          ['Remarks from BIR', compact(row.remarks_bir)],
          ['Claimed from BIR', compact(row.claimed_from_bir)],
        ].filter(([, v]) => Boolean(v)),
      },
    })
  }

  const handleSendSelectedEmails = () => {
    if (!selectedRecords.length) return
    if (selectedRecords.length === 1) {
      handleSendEmail(selectedRecords[0])
      return
    }
    const recipients = [
      ...new Set(
        selectedRecords
          .map((r) => {
            const code = String(r.branch_code || '').trim().toUpperCase()
            const opKey = String(r.operation || '').toUpperCase()
            return r.email || branchEmailMap[opKey] || branchEmailMap[code]
          })
          .filter(Boolean)
      ),
    ]
    const attachments = selectedRecords
      .map((r) => {
        const fid = getDriveFileIdFromLink(r.cor_link)
        if (!fid) return null
        return {
          fileId: fid,
          fileName: `${r.branch_code} - ${r.branch_name || 'Branch'} (COR)`,
          branchCode: r.branch_code,
        }
      })
      .filter(Boolean)

    useUIStore.getState().openSendEmailModal({
      to: recipients,
      subject: `BIR Transmittal Summary (${selectedRecords.length} Branches)`,
      messageBody: `Good day Ma'am/Sir,\n\nKindly see the BIR Transmittal status for the ${selectedRecords.length} selected branches.`,
      refId: `${selectedRecords.length} branches`,
      refType: 'Transmittal',
      emailTitle: 'BIR Transmittal Batch',
      attachments,
      allowNoAttachment: true,
    })
  }

  const normalizeHeader = (h) =>
    String(h || '')
      .replace(/^\uFEFF/, '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')

  const HEADER_ALIASES = {
    branch_code: 'branch_code',
    branch_ccode: 'branch_code',
    code: 'branch_code',
    branch: 'branch_code',
    branch_name: 'branch_name',
    name: 'branch_name',
    type_of_application: 'type_of_application',
    application_type: 'type_of_application',
    type: 'type_of_application',
    date_received_lbc: 'date_received_lbc',
    date_received: 'date_received_lbc',
    lbc_date_received: 'date_received_lbc',
    date_submitted_to_bir: 'date_submitted_bir',
    date_submitted_bir: 'date_submitted_bir',
    date_submitted: 'date_submitted_bir',
    submitted_to_bir: 'date_submitted_bir',
    remarks_from_in_charge: 'remarks_in_charge',
    remarks_in_charge: 'remarks_in_charge',
    in_charge_remarks: 'remarks_in_charge',
    remarks_from_bir: 'remarks_bir',
    remarks_bir: 'remarks_bir',
    bir_remarks: 'remarks_bir',
    claimed_from_bir: 'claimed_from_bir',
    claimed_bir: 'claimed_from_bir',
    claimed: 'claimed_from_bir',
    cor_link: 'cor_link',
    cor: 'cor_link',
    cor_file: 'cor_link',
    link: 'cor_link',
  }

  const handleCsvSelect = async (file) => {
    if (!file) return
    setBulkFileName(file.name)

    let rawText = ''
    try {
      const buffer = await file.arrayBuffer()
      rawText = new TextDecoder('utf-8', { fatal: true }).decode(buffer)
    } catch {
      const buffer = await file.arrayBuffer()
      rawText = new TextDecoder('windows-1252').decode(buffer)
    }

    const cleanText = rawText.replace(/^\uFEFF/, '')
    const firstLine = cleanText.split(/\r?\n/)[0] || ''
    const delimiter = firstLine.includes('\t') && !firstLine.includes(',') ? '\t' : ''

    Papa.parse(cleanText, {
      header: true,
      skipEmptyLines: 'greedy',
      delimiter,
      complete: (results) => {
        const parsed = (results.data || [])
          .map((raw) => {
            const norm = {}
            Object.entries(raw || {}).forEach(([k, v]) => {
              const key = HEADER_ALIASES[normalizeHeader(k)]
              if (key) norm[key] = String(v ?? '').trim()
            })
            if (!norm.branch_code) return null
            const code = norm.branch_code.toUpperCase().replace(/O/g, '0')
            const foundBranch = branchGeoMap.get(code)
            return {
              branch_code: code,
              branch_name: norm.branch_name || foundBranch?.name || '',
              type_of_application: norm.type_of_application || '',
              date_received_lbc: norm.date_received_lbc || '',
              date_submitted_bir: norm.date_submitted_bir || '',
              remarks_in_charge: norm.remarks_in_charge || '',
              remarks_bir: norm.remarks_bir || '',
              claimed_from_bir: norm.claimed_from_bir || '',
              cor_link: norm.cor_link || '',
            }
          })
          .filter(Boolean)

        setBulkRows(parsed)
      },
      error: (err) => {
        Swal.fire('Parse Error', err.message, 'error')
      },
    })
  }

  const handleDownloadTemplate = () => {
    const headers = [
      'branch_code',
      'branch_name',
      'type_of_application',
      'date_received_lbc',
      'date_submitted_bir',
      'remarks_in_charge',
      'remarks_bir',
      'claimed_from_bir',
      'cor_link',
    ]
    const samples = [
      [
        'B0001',
        'Caloocan City I',
        'Update Address',
        '2026-10-15',
        '2026-10-18',
        'Complete requirements received via LBC',
        'For releasing at RDO',
        'Claimed - Oct 25, 2026',
        '',
      ],
      [
        'B0002',
        'Pasig City I',
        'New COR',
        '2026-10-20',
        '2026-10-22',
        'Submitted to liaison officer',
        'Pending signature',
        'Pending',
        '',
      ],
      [
        'B0003',
        'Manila City I',
        'COR Replacement',
        '2026-10-23',
        '2026-10-25',
        'Damaged COR for replacement',
        'In process',
        'Pending',
        '',
      ],
    ]
    const csv = [headers, ...samples]
      .map((r) => r.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'compliance_transmittal_template.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleExportCsv = () => {
    const headers = [
      'BRANCH CODE',
      'BRANCH NAME',
      'TYPE OF APPLICATION',
      'DATE RECEIVED (LBC)',
      'DATE SUBMITTED TO BIR',
      'REMARKS FROM IN CHARGE',
      'REMARKS FROM BIR',
      'CLAIMED FROM BIR',
      'COR LINK',
    ]
    const dataRows = filtered.map((r) => [
      r.branch_code,
      r.branch_name,
      r.type_of_application,
      r.date_received_lbc,
      r.date_submitted_bir,
      r.remarks_in_charge,
      r.remarks_bir,
      r.claimed_from_bir,
      r.cor_link,
    ])
    const csv = [headers, ...dataRows]
      .map((r) => r.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `compliance_transmittal_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleRunBulkImport = async () => {
    if (!bulkRows.length) return
    try {
      const res = await bulkMut.mutateAsync({ rows: bulkRows, mode: bulkMode })
      Swal.fire({
        icon: 'success',
        title: 'Transmittal Import Complete',
        html: `Inserted: <b>${res.inserted}</b><br/>Updated: <b>${res.updated}</b>`,
      })
      setBulkOpen(false)
      setBulkRows([])
      setBulkFileName('')
    } catch (err) {
      Swal.fire('Import Failed', err.message || 'Bulk import error', 'error')
    }
  }

  const resetFilters = () => {
    setSearch('')
    setAppTypeFilter('')
    setStatusFilter('')
    setDateFrom('')
    setDateTo('')
    setSelectedYear('')
    setSelectedMonth('')
    setOperation('')
    setDivision('')
    setRegion('')
    setArea('')
    setBranchFilter('')
    setPage(1)
  }

  return (
    <div className="space-y-4">
      <input
        ref={rowFileInputRef}
        type="file"
        accept=".pdf,image/*"
        className="hidden"
        onChange={handleRowFilePicked}
      />

      <PageHeader
        title="Transmittal"
        subtitle="Track branch BIR applications, LBC receipt dates, BIR submission status, remarks, and COR links."
        icon="fa-truck-fast"
        actions={
          <>
            <Link to="/compliance/dashboard" className="btn-secondary text-xs">
              <i className="fas fa-chart-pie text-indigo-600" /> Compliance Dashboard
            </Link>
            <button
              type="button"
              onClick={() => setShowDashboardTable((prev) => !prev)}
              className="btn-secondary text-xs"
            >
              <i className="fas fa-table text-sky-600" />{' '}
              {showDashboardTable ? 'Hide Monthly Summary' : 'Show Monthly Summary'}
            </button>
            {selectedRecords.length > 0 && (
              <button
                type="button"
                onClick={handleSendSelectedEmails}
                className="btn-primary text-xs bg-orange-600 hover:bg-orange-700 border-orange-600"
              >
                <i className="fas fa-paper-plane" /> Send Selected ({selectedRecords.length})
              </button>
            )}
            <button type="button" onClick={handleExportCsv} className="btn-secondary text-xs">
              <i className="fas fa-file-export text-emerald-600" /> Export CSV
            </button>
            {canManage && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setBulkRows([])
                    setBulkFileName('')
                    setBulkOpen(true)
                  }}
                  className="btn-secondary text-xs"
                >
                  <i className="fas fa-file-csv text-indigo-600" /> Bulk Upload CSV
                </button>
                <button type="button" onClick={openCreate} className="btn-primary text-xs">
                  <i className="fas fa-plus" /> Add Transmittal
                </button>
              </>
            )}
          </>
        }
      />

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <button
          type="button"
          onClick={() => {
            setStatusFilter('')
            setPage(1)
          }}
          className={`card p-3.5 text-left transition hover:shadow-md ${
            statusFilter === '' ? 'ring-2 ring-brand-500/40' : ''
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Total Transmittals
            </span>
            <span className="w-8 h-8 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center">
              <i className="fas fa-truck-fast text-xs" />
            </span>
          </div>
          <div className="mt-1.5 text-2xl font-black text-slate-800">{stats.total}</div>
          <div className="text-[11px] text-slate-500">All branch transmittal records</div>
        </button>

        <button
          type="button"
          onClick={() => {
            setStatusFilter(statusFilter === 'submitted' ? '' : 'submitted')
            setPage(1)
          }}
          className={`card p-3.5 text-left transition hover:shadow-md ${
            statusFilter === 'submitted' ? 'ring-2 ring-sky-500 bg-sky-50/40' : ''
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-sky-600">
              Submitted to BIR
            </span>
            <span className="w-8 h-8 rounded-lg bg-sky-100 text-sky-600 flex items-center justify-center">
              <i className="fas fa-building-columns text-xs" />
            </span>
          </div>
          <div className="mt-1.5 text-2xl font-black text-sky-700">{stats.submittedBir}</div>
          <div className="text-[11px] text-slate-500">Received via LBC: {stats.receivedLbc}</div>
        </button>

        <button
          type="button"
          onClick={() => {
            setStatusFilter(statusFilter === 'claimed' ? '' : 'claimed')
            setPage(1)
          }}
          className={`card p-3.5 text-left transition hover:shadow-md ${
            statusFilter === 'claimed' ? 'ring-2 ring-indigo-500 bg-indigo-50/40' : ''
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-600">
              Claimed from BIR
            </span>
            <span className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center">
              <i className="fas fa-clipboard-check text-xs" />
            </span>
          </div>
          <div className="mt-1.5 text-2xl font-black text-indigo-700">{stats.claimedBir}</div>
          <div className="text-[11px] text-slate-500">With Claimed status / date</div>
        </button>

        <button
          type="button"
          onClick={() => {
            setStatusFilter(statusFilter === 'with_cor' ? '' : 'with_cor')
            setPage(1)
          }}
          className={`card p-3.5 text-left transition hover:shadow-md ${
            statusFilter === 'with_cor' ? 'ring-2 ring-emerald-500 bg-emerald-50/40' : ''
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600">
              With COR Link
            </span>
            <span className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center">
              <i className="fas fa-file-circle-check text-xs" />
            </span>
          </div>
          <div className="mt-1.5 text-2xl font-black text-emerald-700">{stats.withCor}</div>
          <div className="text-[11px] text-slate-500">COR file uploaded & linked</div>
        </button>

        <button
          type="button"
          onClick={() => {
            setStatusFilter(statusFilter === 'no_cor' ? '' : 'no_cor')
            setPage(1)
          }}
          className={`card p-3.5 text-left transition hover:shadow-md ${
            statusFilter === 'no_cor' ? 'ring-2 ring-amber-500 bg-amber-50/40' : ''
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-600">
              Pending COR File
            </span>
            <span className="w-8 h-8 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center">
              <i className="fas fa-hourglass-half text-xs" />
            </span>
          </div>
          <div className="mt-1.5 text-2xl font-black text-amber-700">
            {Math.max(0, stats.total - stats.withCor)}
          </div>
          <div className="text-[11px] text-slate-500">Awaiting COR attachment</div>
        </button>
      </div>

      {/* Filters */}
      <div className="card relative z-30 overflow-visible p-4 space-y-3">
        {/* Row 1: Search, Type of Application, Status, Date Filters, Reset */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative min-w-[240px] flex-1">
            <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
              placeholder="Search branch code, branch name, application type, or remarks..."
              className="input pl-9"
            />
          </div>

          <select
            value={appTypeFilter}
            onChange={(e) => {
              setAppTypeFilter(e.target.value)
              setPage(1)
            }}
            className="input h-10 w-auto min-w-[180px] py-1.5 text-xs font-semibold"
          >
            <option value="">All Application Types</option>
            {applicationTypeOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value)
              setPage(1)
            }}
            className="input h-10 w-auto min-w-[175px] py-1.5 text-xs font-semibold"
          >
            <option value="">All Transmittal Status</option>
            <option value="submitted">Submitted to BIR</option>
            <option value="pending_bir">Pending BIR Submission</option>
            <option value="claimed">Claimed from BIR</option>
            <option value="with_cor">With COR Link</option>
            <option value="no_cor">Pending COR Link</option>
          </select>

          <input
            type="date"
            value={dateFrom}
            onChange={(e) => {
              setDateFrom(e.target.value)
              setPage(1)
            }}
            title="Date From"
            className="input h-10 w-[142px] py-1.5 text-xs font-semibold"
          />
          <span className="text-xs font-semibold text-gray-400">to</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => {
              setDateTo(e.target.value)
              setPage(1)
            }}
            title="Date To"
            className="input h-10 w-[142px] py-1.5 text-xs font-semibold"
          />

          <select
            value={selectedYear}
            onChange={(e) => {
              setSelectedYear(e.target.value)
              setPage(1)
            }}
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
            onChange={(e) => {
              setSelectedMonth(e.target.value)
              setPage(1)
            }}
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
            value={perPage}
            onChange={(e) => {
              setPerPage(Number(e.target.value))
              setPage(1)
            }}
            className="input h-10 w-[110px] py-1.5 text-xs font-semibold"
          >
            <option value={25}>25 / page</option>
            <option value={50}>50 / page</option>
            <option value={100}>100 / page</option>
          </select>

          <button
            type="button"
            onClick={resetFilters}
            className="btn-secondary h-10 text-xs px-3.5 whitespace-nowrap"
          >
            <i className="fas fa-sync-alt mr-1.5" />Reset Filters
          </button>
        </div>

        {/* Row 2: Geographic Hierarchy Filters */}
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-5">
          <SegmentedSearchSelect
            label="Operation"
            value={operation}
            options={operations.map((o) => ({ value: o, label: o }))}
            onChange={(val) => {
              setOperation(val)
              setDivision('')
              setRegion('')
              setArea('')
              setBranchFilter('')
              setPage(1)
            }}
            className="w-full"
          />

          <SegmentedSearchSelect
            label="Division"
            value={division}
            options={divisions.map((d) => ({ value: d, label: d }))}
            onChange={(val) => {
              setDivision(val)
              setRegion('')
              setArea('')
              setBranchFilter('')
              setPage(1)
            }}
            className="w-full"
          />

          <SegmentedSearchSelect
            label="Region"
            value={region}
            options={regions.map((r) => ({ value: r, label: r }))}
            onChange={(val) => {
              setRegion(val)
              setArea('')
              setBranchFilter('')
              setPage(1)
            }}
            className="w-full"
          />

          <SegmentedSearchSelect
            label="Area"
            value={area}
            options={areas.map((a) => ({ value: a, label: a }))}
            onChange={(val) => {
              setArea(val)
              setBranchFilter('')
              setPage(1)
            }}
            className="w-full"
          />

          <SegmentedSearchSelect
            label="Branch"
            value={branchFilter}
            onChange={(val) => {
              setBranchFilter(val)
              setPage(1)
            }}
            options={branchSelectOptions}
            placeholder="All"
            className="w-full"
          />
        </div>
      </div>

      {/* Transmittal Monthly Summary Dashboard (Jan - Dec + Total) */}
      {showDashboardTable && (
        <div className="card overflow-hidden">
          <div className="px-5 py-3 bg-slate-900 text-white flex items-center justify-between">
            <div className="flex items-center gap-2">
              <i className="fas fa-calendar-days text-indigo-400" />
              <h3 className="text-xs font-black uppercase tracking-wider">
                Transmittal Monthly Summary{' '}
                {selectedYear ? `(${selectedYear})` : '(January – December)'}
              </h3>
            </div>
            <Link
              to="/compliance/dashboard"
              className="text-[11px] font-bold text-indigo-300 hover:text-white transition"
            >
              View Full Compliance Dashboard <i className="fas fa-arrow-right ml-1" />
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1150px] text-xs border-collapse text-center">
              <thead>
                <tr className="bg-slate-100 text-slate-700 font-black border-b border-slate-200 text-[11px]">
                  <th className="py-2.5 px-4 text-left w-[195px] border-r border-slate-200">
                    TRANSMITTAL
                  </th>
                  {MONTH_NAMES.map((m) => (
                    <th key={m} className="py-2.5 px-2.5 border-r border-slate-200">
                      {m}
                    </th>
                  ))}
                  <th className="py-2.5 px-3.5 bg-slate-200/70 text-slate-900">TOTAL</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {transmittalMonthlyMatrix.map((row) => (
                  <tr key={row.label} className="hover:bg-slate-50">
                    <td
                      className={`py-2.5 px-4 text-left font-black border-r border-slate-200 ${row.tone}`}
                    >
                      {row.label}
                    </td>
                    {row.months.map((val, mIdx) => (
                      <td
                        key={mIdx}
                        className={`py-2.5 px-2.5 border-r border-slate-200 font-semibold ${
                          val > 0 ? 'text-slate-800' : 'text-slate-400'
                        }`}
                      >
                        {val}
                      </td>
                    ))}
                    <td className="py-2.5 px-3.5 font-black text-slate-900 bg-slate-50">
                      {row.total}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <tbody>
                <TableLoader cols={10} rows={8} />
              </tbody>
            </table>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 px-4 text-center">
            <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
              <i className="fas fa-truck-fast text-xl" />
            </div>
            <h4 className="text-sm font-black text-slate-700">No transmittal records found</h4>
            <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
              Add a branch transmittal record or upload a CSV file to get started.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1480px] text-xs border-collapse">
              <thead>
                <tr className="bg-slate-900 text-white text-left text-[11px] uppercase tracking-wider">
                  <th className="py-3 px-2.5 w-[38px] text-center">
                    <input
                      type="checkbox"
                      checked={isAllPagedSelected}
                      onChange={toggleSelectAllPaged}
                      className="rounded border-slate-400 text-brand-600 focus:ring-brand-500 cursor-pointer"
                      title="Select all on this page"
                    />
                  </th>
                  <th className="py-3 px-2.5 w-[44px] text-center">#</th>
                  <th className="py-3 px-3 w-[115px]">Branch Code</th>
                  <th className="py-3 px-3 w-[200px]">Branch Name</th>
                  <th className="py-3 px-3 w-[175px]">Type of Application</th>
                  <th className="py-3 px-3 w-[135px]">Date Received (LBC)</th>
                  <th className="py-3 px-3 w-[145px]">Date Submitted to BIR</th>
                  <th className="py-3 px-3 w-[220px]">Remarks from In Charge</th>
                  <th className="py-3 px-3 w-[220px]">Remarks from BIR</th>
                  <th className="py-3 px-3 w-[140px]">Claimed from BIR</th>
                  <th className="py-3 px-3 w-[145px] text-center">COR Link</th>
                  <th className="py-3 px-3 w-[140px] text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paged.map((row, idx) => {
                  const rowNum = (page - 1) * perPage + idx + 1
                  const hasCor = Boolean(compact(row.cor_link))
                  return (
                    <tr
                      key={row.id || row.branch_code}
                      onClick={() => openDetails(row)}
                      className="hover:bg-blue-50/40 transition-colors align-top cursor-pointer"
                    >
                      <td
                        className="py-3 px-2.5 text-center"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(row.id)}
                          onChange={() => toggleSelectRow(row.id)}
                          className="rounded border-slate-300 text-brand-600 focus:ring-brand-500 cursor-pointer"
                        />
                      </td>
                      <td className="py-3 px-2.5 text-center font-semibold text-slate-400">
                        {rowNum}
                      </td>
                      <td className="py-3 px-3 font-black text-slate-800 whitespace-nowrap">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 text-slate-800 font-mono text-xs">
                          {row.branch_code}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-bold text-slate-800 leading-snug break-words">
                          {row.branch_name || '—'}
                        </div>
                        {(row.area || row.region) && (
                          <div className="text-[10px] text-slate-400 mt-0.5 break-words">
                            {[row.area, row.region].filter(Boolean).join(' • ')}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        {row.type_of_application ? (
                          <span
                            className={`inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] font-bold border leading-snug ${
                              row.type_of_application === 'New COR'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : row.type_of_application === 'Update Address'
                                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                                  : 'bg-indigo-50 text-indigo-700 border-indigo-200'
                            }`}
                          >
                            {row.type_of_application}
                          </span>
                        ) : (
                          <span className="text-slate-300 italic">—</span>
                        )}
                      </td>
                      <td className="py-3 px-3 font-medium text-slate-700 whitespace-nowrap">
                        {row.date_received_lbc ? (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">
                            <i className="fas fa-box-open text-[10px] text-amber-600" />
                            {row.date_received_lbc}
                          </span>
                        ) : (
                          <span className="text-slate-300 italic">—</span>
                        )}
                      </td>
                      <td className="py-3 px-3 font-medium text-slate-700 whitespace-nowrap">
                        {row.date_submitted_bir ? (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-sky-50 text-sky-700 border border-sky-200">
                            <i className="fas fa-calendar-check text-[10px]" />
                            {row.date_submitted_bir}
                          </span>
                        ) : (
                          <span className="text-slate-300 italic">—</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-slate-700 leading-relaxed whitespace-normal break-words">
                        {row.remarks_in_charge || <span className="text-slate-300 italic">—</span>}
                      </td>
                      <td className="py-3 px-3 text-slate-700 leading-relaxed whitespace-normal break-words">
                        {row.remarks_bir || <span className="text-slate-300 italic">—</span>}
                      </td>
                      <td className="py-3 px-3">
                        {row.claimed_from_bir ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <i className="fas fa-check-circle text-[10px]" />
                            {row.claimed_from_bir}
                          </span>
                        ) : (
                          <span className="text-slate-300 italic">—</span>
                        )}
                      </td>

                      {/* COR Link column */}
                      <td
                        className="py-3 px-3 text-center"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-center gap-1.5 flex-wrap">
                          {hasCor ? (
                            <button
                              type="button"
                              onClick={() =>
                                setPreviewFile({
                                  fileId: row.cor_link,
                                  title: `${row.branch_code} - ${row.branch_name} (COR)`,
                                })
                              }
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-teal-50 text-teal-700 hover:bg-teal-100 border border-teal-200 font-semibold text-[11px] transition"
                              title="Preview COR Certificate"
                            >
                              <i className="fas fa-eye" /> View COR
                            </button>
                          ) : (
                            <span className="text-[11px] text-slate-400 italic">No file</span>
                          )}
                          {canManage && (
                            <button
                              type="button"
                              onClick={() => triggerRowUpload(row)}
                              className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-slate-100 hover:bg-brand-50 text-slate-600 hover:text-brand-600 transition"
                              title={hasCor ? 'Replace COR File' : 'Upload COR File'}
                            >
                              <i className="fas fa-upload text-[11px]" />
                            </button>
                          )}
                        </div>
                      </td>

                      {/* Actions */}
                      <td
                        className="py-3 px-3 text-center"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => openDetails(row)}
                            className="w-7 h-7 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-600 inline-flex items-center justify-center transition"
                            title="View Details"
                          >
                            <i className="fas fa-eye text-[11px]" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSendEmail(row)}
                            className="w-7 h-7 rounded-lg bg-orange-50 hover:bg-orange-100 text-orange-600 inline-flex items-center justify-center transition"
                            title="Send to Email"
                          >
                            <i className="fas fa-envelope text-[11px]" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setTimelineId(row.branch_code)}
                            className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-indigo-50 text-slate-600 hover:text-indigo-600 inline-flex items-center justify-center transition"
                            title="View History"
                          >
                            <i className="fas fa-clock-rotate-left text-[11px]" />
                          </button>
                          {canManage && (
                            <button
                              type="button"
                              onClick={() => openEdit(row)}
                              className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-amber-50 text-slate-600 hover:text-amber-600 inline-flex items-center justify-center transition"
                              title="Edit Row"
                            >
                              <i className="fas fa-pen text-[11px]" />
                            </button>
                          )}
                          {isAdmin && (
                            <button
                              type="button"
                              onClick={() => handleDelete(row)}
                              className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-600 inline-flex items-center justify-center transition"
                              title="Delete Row"
                            >
                              <i className="fas fa-trash text-[11px]" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {filtered.length > 0 && (
          <div className="px-4 py-3 border-t border-slate-100">
            <Pagination
              page={page}
              perPage={perPage}
              total={filtered.length}
              onChange={setPage}
            />
          </div>
        )}
      </div>

      {/* Add / Edit Modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setModalOpen(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div>
                <h3 className="text-base font-black text-slate-800">
                  {editing
                    ? `Edit Transmittal — ${editing.branch_code}`
                    : 'Add Transmittal Record'}
                </h3>
                <p className="text-xs text-slate-500">
                  Fill in the LBC receipt date, BIR submission details, remarks, and COR link.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="w-8 h-8 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700"
              >
                <i className="fas fa-times" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Branch Quick Fill (Optional)
                  </label>
                  <SegmentedSearchSelect
                    value={form.branch_code}
                    onChange={handleBranchSelect}
                    options={branchSelectOptions}
                    placeholder="Pick from directory..."
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Branch Code <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.branch_code}
                    onChange={(e) =>
                      setForm({ ...form, branch_code: e.target.value.toUpperCase() })
                    }
                    placeholder="e.g. B0001"
                    className="input w-full uppercase font-mono"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Branch Name</label>
                  <input
                    type="text"
                    value={form.branch_name}
                    onChange={(e) => setForm({ ...form, branch_name: e.target.value })}
                    placeholder="e.g. Caloocan City I"
                    className="input w-full"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Type of Application
                  </label>
                  <select
                    value={form.type_of_application}
                    onChange={(e) => setForm({ ...form, type_of_application: e.target.value })}
                    className="input w-full"
                  >
                    <option value="">Select Type of Application</option>
                    {applicationTypeOptions.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Date Received (LBC)
                  </label>
                  <input
                    type="text"
                    value={form.date_received_lbc}
                    onChange={(e) => setForm({ ...form, date_received_lbc: e.target.value })}
                    placeholder="YYYY-MM-DD or text"
                    className="input w-full"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Date Submitted to BIR
                  </label>
                  <input
                    type="text"
                    value={form.date_submitted_bir}
                    onChange={(e) => setForm({ ...form, date_submitted_bir: e.target.value })}
                    placeholder="YYYY-MM-DD or text"
                    className="input w-full"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Claimed from BIR
                  </label>
                  <input
                    type="text"
                    value={form.claimed_from_bir}
                    onChange={(e) => setForm({ ...form, claimed_from_bir: e.target.value })}
                    placeholder="e.g. Claimed / Date / Pending"
                    className="input w-full"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Remarks from In Charge
                  </label>
                  <textarea
                    rows={2}
                    value={form.remarks_in_charge}
                    onChange={(e) => setForm({ ...form, remarks_in_charge: e.target.value })}
                    placeholder="Enter remarks from person in charge..."
                    className="input w-full"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Remarks from BIR
                  </label>
                  <textarea
                    rows={2}
                    value={form.remarks_bir}
                    onChange={(e) => setForm({ ...form, remarks_bir: e.target.value })}
                    placeholder="Enter remarks or status from BIR..."
                    className="input w-full"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  COR Link / Attachment
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={form.cor_link}
                    onChange={(e) => setForm({ ...form, cor_link: e.target.value })}
                    placeholder="Google Drive link or File ID"
                    className="input flex-1"
                  />
                  <label className="btn-secondary cursor-pointer shrink-0">
                    <i
                      className={`fas ${
                        uploadingField === 'cor_link' ? 'fa-spinner fa-spin' : 'fa-upload'
                      }`}
                    />
                    <span>Upload File</span>
                    <input
                      type="file"
                      accept=".pdf,image/*"
                      className="hidden"
                      disabled={Boolean(uploadingField)}
                      onChange={(e) => handleFormFileUpload(e.target.files?.[0])}
                    />
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMut.isPending || updateMut.isPending}
                  className="btn-primary"
                >
                  <i className="fas fa-save" /> Save Transmittal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Row Details & Quick Update Modal */}
      {previewRecord && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setPreviewRecord(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 px-6 py-4 border-b border-slate-100 bg-slate-50/70">
              <div className="flex items-center gap-3">
                <span className="px-3 py-1.5 rounded-xl bg-slate-900 text-white font-mono text-sm font-black">
                  {previewRecord.branch_code}
                </span>
                <div>
                  <h3 className="text-base font-black text-slate-800">
                    {previewRecord.branch_name || 'Unnamed Branch'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {[previewRecord.operation, previewRecord.division, previewRecord.region, previewRecord.area]
                      .filter(Boolean)
                      .join(' • ') || 'Compliance Transmittal Details'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPreviewRecord(null)}
                className="w-8 h-8 rounded-lg hover:bg-slate-200/70 text-slate-400 hover:text-slate-700"
              >
                <i className="fas fa-times" />
              </button>
            </div>

            <div className="p-6 space-y-5 text-xs">
              {canManage && !detailEditMode && (
                <div className="flex items-center justify-between gap-3 p-3.5 rounded-xl bg-gradient-to-r from-indigo-50 via-sky-50 to-teal-50 border border-indigo-200/80">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                      <i className="fas fa-file-pen text-sm" />
                    </div>
                    <div>
                      <div className="font-black text-slate-800 text-xs">
                        Update Transmittal Status or Attach Released COR
                      </div>
                      <div className="text-[11px] text-slate-600">
                        Update BIR remarks, claimed status, and upload the released COR file in one step.
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDetailEditMode(true)}
                    className="btn-primary text-xs shrink-0"
                  >
                    <i className="fas fa-pen-to-square" /> Update Transmittal
                  </button>
                </div>
              )}

              {detailEditMode ? (
                <form
                  onSubmit={handleSaveDetailUpdate}
                  className="p-4 rounded-2xl border-2 border-brand-500/30 bg-brand-50/20 space-y-4"
                >
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
                    <div className="font-black text-slate-800 text-sm flex items-center gap-2">
                      <i className="fas fa-pen-to-square text-brand-600" />
                      Update Transmittal — {previewRecord.branch_code}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setDetailEditMode(false)
                        setDetailReplacementFile(null)
                      }}
                      className="text-xs font-semibold text-slate-500 hover:text-slate-800"
                    >
                      Cancel
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">
                        Branch Name
                      </label>
                      <input
                        type="text"
                        value={detailForm.branch_name}
                        onChange={(e) =>
                          setDetailForm({ ...detailForm, branch_name: e.target.value })
                        }
                        className="input w-full"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">
                        Type of Application
                      </label>
                      <select
                        value={detailForm.type_of_application}
                        onChange={(e) =>
                          setDetailForm({ ...detailForm, type_of_application: e.target.value })
                        }
                        className="input w-full"
                      >
                        <option value="">Select Type of Application</option>
                        {applicationTypeOptions.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">
                        Date Received (LBC)
                      </label>
                      <input
                        type="text"
                        value={detailForm.date_received_lbc}
                        onChange={(e) =>
                          setDetailForm({ ...detailForm, date_received_lbc: e.target.value })
                        }
                        className="input w-full"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">
                        Date Submitted to BIR
                      </label>
                      <input
                        type="text"
                        value={detailForm.date_submitted_bir}
                        onChange={(e) =>
                          setDetailForm({ ...detailForm, date_submitted_bir: e.target.value })
                        }
                        className="input w-full"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">
                        Claimed from BIR
                      </label>
                      <input
                        type="text"
                        value={detailForm.claimed_from_bir}
                        onChange={(e) =>
                          setDetailForm({ ...detailForm, claimed_from_bir: e.target.value })
                        }
                        className="input w-full"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">
                        Remarks from In Charge
                      </label>
                      <textarea
                        rows={2}
                        value={detailForm.remarks_in_charge}
                        onChange={(e) =>
                          setDetailForm({ ...detailForm, remarks_in_charge: e.target.value })
                        }
                        className="input w-full"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">
                        Remarks from BIR
                      </label>
                      <textarea
                        rows={2}
                        value={detailForm.remarks_bir}
                        onChange={(e) =>
                          setDetailForm({ ...detailForm, remarks_bir: e.target.value })
                        }
                        className="input w-full"
                      />
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-white border border-slate-200 space-y-2.5">
                    <label className="block font-bold text-slate-700">
                      Attach COR File (Image or PDF)
                    </label>
                    <div className="flex flex-wrap items-center gap-2.5">
                      <label className="btn-secondary cursor-pointer text-xs">
                        <i className="fas fa-cloud-arrow-up text-brand-600" />
                        <span>
                          {detailReplacementFile
                            ? 'Change Selected File'
                            : 'Choose COR Image / PDF'}
                        </span>
                        <input
                          type="file"
                          accept=".pdf,image/*"
                          className="hidden"
                          onChange={(e) =>
                            setDetailReplacementFile(e.target.files?.[0] || null)
                          }
                        />
                      </label>
                      {detailReplacementFile ? (
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 font-semibold">
                          <i className="fas fa-file-circle-check" />
                          <span>{detailReplacementFile.name}</span>
                          <button
                            type="button"
                            onClick={() => setDetailReplacementFile(null)}
                            className="text-emerald-600 hover:text-rose-600 ml-1"
                          >
                            <i className="fas fa-times" />
                          </button>
                        </div>
                      ) : (
                        <input
                          type="text"
                          value={detailForm.cor_link}
                          onChange={(e) =>
                            setDetailForm({ ...detailForm, cor_link: e.target.value })
                          }
                          placeholder="Or paste Google Drive COR link..."
                          className="input flex-1 min-w-[220px]"
                        />
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setDetailEditMode(false)
                        setDetailReplacementFile(null)
                      }}
                      className="btn-secondary text-xs"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={savingDetailUpdate}
                      className="btn-primary text-xs"
                    >
                      <i
                        className={`fas ${
                          savingDetailUpdate ? 'fa-spinner fa-spin' : 'fa-check'
                        }`}
                      />
                      {savingDetailUpdate ? 'Saving Update...' : 'Save Changes'}
                    </button>
                  </div>
                </form>
              ) : (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="p-3.5 rounded-xl bg-indigo-50/60 border border-indigo-200/70">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-indigo-600">
                        Type of Application
                      </div>
                      <div className="mt-1 font-bold text-slate-800 text-sm">
                        {previewRecord.type_of_application || '—'}
                      </div>
                    </div>
                    <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Date Received (LBC)
                      </div>
                      <div className="mt-1 font-bold text-slate-800 text-sm">
                        {previewRecord.date_received_lbc || '—'}
                      </div>
                    </div>
                    <div className="p-3.5 rounded-xl bg-sky-50/60 border border-sky-200/70">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-sky-600">
                        Date Submitted to BIR
                      </div>
                      <div className="mt-1 font-bold text-slate-800 text-sm">
                        {previewRecord.date_submitted_bir || '—'}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-4 rounded-xl bg-amber-50/50 border border-amber-200/70">
                      <div className="text-[11px] font-bold uppercase tracking-wider text-amber-700 mb-1.5 flex items-center gap-1.5">
                        <i className="fas fa-user-check" /> Remarks from In Charge
                      </div>
                      <div className="text-slate-800 text-sm leading-relaxed break-words">
                        {previewRecord.remarks_in_charge || (
                          <span className="text-slate-400 italic">No remarks</span>
                        )}
                      </div>
                    </div>

                    <div className="p-4 rounded-xl bg-sky-50/50 border border-sky-200/70">
                      <div className="text-[11px] font-bold uppercase tracking-wider text-sky-700 mb-1.5 flex items-center gap-1.5">
                        <i className="fas fa-building-columns" /> Remarks from BIR
                      </div>
                      <div className="text-slate-800 text-sm leading-relaxed break-words">
                        {previewRecord.remarks_bir || (
                          <span className="text-slate-400 italic">No remarks</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-3.5 rounded-xl bg-emerald-50/60 border border-emerald-200/70">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                        Claimed from BIR
                      </div>
                      <div className="mt-1 font-bold text-emerald-900 text-sm">
                        {previewRecord.claimed_from_bir || '—'}
                      </div>
                    </div>

                    <div className="p-3.5 rounded-xl bg-teal-50/60 border border-teal-200/70 flex items-center justify-between gap-2">
                      <div>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-teal-700">
                          COR Link / Attachment
                        </div>
                        <div className="mt-1 font-bold text-slate-800 text-xs">
                          {compact(previewRecord.cor_link)
                            ? 'COR Certificate Attached'
                            : 'No COR file attached yet'}
                        </div>
                      </div>
                      {compact(previewRecord.cor_link) && (
                        <button
                          type="button"
                          onClick={() => {
                            const rec = previewRecord
                            setPreviewRecord(null)
                            setPreviewFile({
                              fileId: rec.cor_link,
                              title: `${rec.branch_code} - ${rec.branch_name} (COR)`,
                            })
                          }}
                          className="btn-primary text-xs shrink-0"
                        >
                          <i className="fas fa-eye" /> Preview COR
                        </button>
                      )}
                    </div>
                  </div>
                </>
              )}

              <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-100">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const rec = previewRecord
                      setPreviewRecord(null)
                      handleSendEmail(rec)
                    }}
                    className="btn-secondary text-xs text-orange-600 border-orange-200 hover:bg-orange-50"
                  >
                    <i className="fas fa-envelope" /> Send to Email
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const code = previewRecord.branch_code
                      setPreviewRecord(null)
                      setTimelineId(code)
                    }}
                    className="btn-secondary text-xs"
                  >
                    <i className="fas fa-clock-rotate-left" /> History Log
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  {canManage && !detailEditMode && (
                    <button
                      type="button"
                      onClick={() => setDetailEditMode(true)}
                      className="btn-secondary text-xs"
                    >
                      <i className="fas fa-pen" /> Edit Record
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setPreviewRecord(null)}
                    className="btn-secondary text-xs"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bulk CSV Import Modal */}
      {bulkOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setBulkOpen(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div>
                <h3 className="text-base font-black text-slate-800">
                  Bulk Upload CSV — Transmittal
                </h3>
                <p className="text-xs text-slate-500">
                  Columns: branch_code, branch_name, type_of_application, date_received_lbc,
                  date_submitted_bir, remarks_in_charge, remarks_bir, claimed_from_bir, cor_link
                </p>
              </div>
              <button
                type="button"
                onClick={() => setBulkOpen(false)}
                className="w-8 h-8 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700"
              >
                <i className="fas fa-times" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <div className="space-y-0.5">
                  <div className="font-bold text-slate-700">Import Mode</div>
                  <div className="text-[11px] text-slate-500">
                    Choose whether to update existing branch codes or insert only.
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={bulkMode}
                    onChange={(e) => setBulkMode(e.target.value)}
                    className="input text-xs w-auto"
                  >
                    <option value="upsert">Upsert (Update existing + Insert new)</option>
                    <option value="insert">Insert All Only</option>
                  </select>
                  <button
                    type="button"
                    onClick={handleDownloadTemplate}
                    className="btn-secondary text-xs"
                  >
                    <i className="fas fa-download" /> Sample CSV
                  </button>
                </div>
              </div>

              <div
                onClick={() => bulkInputRef.current?.click()}
                className="border-2 border-dashed border-slate-300 hover:border-brand-500 rounded-2xl p-6 text-center cursor-pointer transition bg-slate-50/50"
              >
                <i className="fas fa-cloud-arrow-up text-2xl text-brand-500 mb-2" />
                <p className="font-bold text-slate-700">
                  {bulkFileName || 'Click to choose a CSV or TSV file'}
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Supports UTF-8 and Excel CSV exports
                </p>
                <input
                  ref={bulkInputRef}
                  type="file"
                  accept=".csv,.tsv,.txt"
                  className="hidden"
                  onChange={(e) => handleCsvSelect(e.target.files?.[0])}
                />
              </div>

              {bulkRows.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-700">
                      Previewing {Math.min(8, bulkRows.length)} of {bulkRows.length} valid rows
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setBulkRows([])
                        setBulkFileName('')
                      }}
                      className="text-rose-600 hover:underline font-semibold"
                    >
                      Clear
                    </button>
                  </div>
                  <div className="overflow-x-auto border border-slate-200 rounded-xl max-h-56">
                    <table className="w-full text-[11px]">
                      <thead className="bg-slate-100 text-slate-700 sticky top-0">
                        <tr>
                          <th className="p-2 text-left">Code</th>
                          <th className="p-2 text-left">Branch Name</th>
                          <th className="p-2 text-left">Type of Application</th>
                          <th className="p-2 text-left">Date Rcvd (LBC)</th>
                          <th className="p-2 text-left">Submitted BIR</th>
                          <th className="p-2 text-left">Claimed BIR</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {bulkRows.slice(0, 8).map((r, i) => (
                          <tr key={i}>
                            <td className="p-2 font-mono font-bold">{r.branch_code}</td>
                            <td className="p-2">{r.branch_name}</td>
                            <td className="p-2">{r.type_of_application}</td>
                            <td className="p-2">{r.date_received_lbc}</td>
                            <td className="p-2">{r.date_submitted_bir}</td>
                            <td className="p-2">{r.claimed_from_bir}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setBulkOpen(false)}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!bulkRows.length || bulkMut.isPending}
                  onClick={handleRunBulkImport}
                  className="btn-primary"
                >
                  <i
                    className={`fas ${
                      bulkMut.isPending ? 'fa-spinner fa-spin' : 'fa-cloud-upload-alt'
                    }`}
                  />
                  Import {bulkRows.length ? `(${bulkRows.length})` : ''}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* File Preview Modal */}
      {previewFile && (
        <FilePreviewModal
          fileId={getDriveFileIdFromLink(previewFile.fileId)}
          title={previewFile.title}
          onClose={() => setPreviewFile(null)}
        />
      )}

      {/* History Timeline Modal */}
      {timelineId && (
        <TimelineModal
          recordId={timelineId}
          onClose={() => setTimelineId(null)}
        />
      )}
    </div>
  )
}
