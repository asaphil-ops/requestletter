import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Archive,
  CalendarDays,
  CheckCheck,
  Download,
  FilePlus2,
  FileText,
  Filter,
  Mail,
  CircleDollarSign,
  Search,
  ShieldCheck,
  Trash2,
  X,
} from 'lucide-react'
import { useRequests, useCreateRequest, useUpdateRequest, useDeleteRequest, useProcessRequest, useAttachFile } from '../hooks/useRequests'
import { useSettings } from '../hooks/useAccounts'
import { useAuthStore } from '../store/authStore'
import { useBranches, useBranchMap, useBranchOptions, useBranchEmailMap } from '../hooks/useBranches'
import { useStaff } from '../hooks/useStaff'
import { useEmployeeList } from '../hooks/useEmployeeList'
import { uploadToDrive } from '../lib/gas'
import { fmtCurrency, getUploadedAt, ROWS_PER_PAGE } from '../lib/utils'
import StatusBadge from '../components/shared/StatusBadge'
import { OpsModal } from '../components/shared/ProcessModal'
import FilePreviewModal from '../components/shared/FilePreviewModal'
import Pagination from '../components/shared/Pagination'
import { TableLoader, EmptyRow } from '../components/shared/Loader'
import SegmentedSearchSelect from '../components/shared/SegmentedSearchSelect'
import Swal from 'sweetalert2'

// Mapping of operations to recipient email addresses
const OPERATION_EMAIL_MAP = {
  "LUZON I": "jinnette.anacio@asaphil.org",
  "LUZON II": "cynthia.casido@asaphil.org",
  "VISAYAS I": "jonnie.borgonia@asaphil.org",
  "VISAYAS II": "sharon.galeno@asaphil.org",
  "MINDANAO I": "taib.abduraji@asaphil.org",
  "MINDANAO II": "arlyn.yagaya@asaphil.org",
};

const normalizeRequestStatus = (value) => value === 'Approved' ? 'Checked' : value

export default function Requests() {
  const { canCheck, canUpload, isAdmin } = useAuthStore()
  const navigate = useNavigate()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('All')
  const [dateStart, setDateStart] = useState('')
  const [dateEnd, setDateEnd] = useState('')
  const [geoFilter, setGeoFilter] = useState({ operation: '', division: '', region: '', area: '', branchCode: '' })
  const [selected, setSelected] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [opsTarget, setOpsTarget] = useState(null) // Keep opsTarget for 'Check' action
  const [previewFile, setPreviewFile] = useState(null) // Keep previewFile
  const [sortKey, setSortKey] = useState('created_at')
  const [branchLookupOpen, setBranchLookupOpen] = useState(false)
  const [sortDir, setSortDir] = useState('desc')

  const { data: branches = [] } = useBranches()
  const branchMap = useBranchMap()
  const { data: allRequests = [], isLoading } = useRequests()
  const { data: settings } = useSettings()
  const createReq = useCreateRequest()
  const updateReq = useUpdateRequest()
  const deleteReq = useDeleteRequest()
  const processReq = useProcessRequest()
  const attachFile = useAttachFile()
  const branchEmailMap = useBranchEmailMap()
  const branchOptions = useBranchOptions()
  const { data: staffList = [] } = useStaff()
  const { data: employeeList = [] } = useEmployeeList()

  const titles = settings?.titles || []

  // Form state
  const [form, setForm] = useState({ type: 'Staff Request', beneficiary: '', date_req: '', title: '', description: '', amount: '' })

  // Dynamically compute geo lists based on current selected values (cascading options)
  const geoLists = useMemo(() => {
    // 1. Available Operations
    const operations = [...new Set(branches.map(b => b.operation).filter(Boolean))].sort()

    // 2. Filter branches by selected operation for Division
    let divBranches = branches
    if (geoFilter.operation) {
      divBranches = divBranches.filter(b => b.operation === geoFilter.operation)
    }
    const divisions = [...new Set(divBranches.map(b => b.division).filter(Boolean))].sort()

    // 3. Filter branches by selected operation & division for Region
    let regBranches = divBranches
    if (geoFilter.division) {
      regBranches = regBranches.filter(b => b.division === geoFilter.division)
    }
    const regions = [...new Set(regBranches.map(b => b.region).filter(Boolean))].sort()

    // 4. Filter branches by selected operation, division & region for Area
    let areaBranches = regBranches
    if (geoFilter.region) {
      areaBranches = areaBranches.filter(b => b.region === geoFilter.region)
    }
    const areas = [...new Set(areaBranches.map(b => b.area).filter(Boolean))].sort()

    // 5. Filter branches by selected operation, division, region & area for Branch Code
    let branchList = areaBranches
    if (geoFilter.area) {
      branchList = branchList.filter(b => b.area === geoFilter.area)
    }
    const branchesOptions = branchList
      .filter(b => b.code && b.name)
      .map(b => ({ value: b.code, label: `${b.code} - ${b.name}` }))
      .sort((a, b) => a.label.localeCompare(b.label))

    return { operations, divisions, regions, areas, branchesOptions }
  }, [branches, geoFilter.operation, geoFilter.division, geoFilter.region, geoFilter.area])

  const staffMap = useMemo(() => {
    const map = {}
    staffList.forEach(s => {
      const fullName = `${s.first_name || ''} ${s.last_name || ''}`.trim().toLowerCase()
      if (fullName) map[fullName] = s
      if (s.name) map[s.name.toLowerCase()] = s
    })
    return map
  }, [staffList])

  const filtered = useMemo(() => {
    let arr = [...allRequests]
    if (status !== 'All') arr = arr.filter(r => normalizeRequestStatus(r.status) === status)
    if (search) arr = arr.filter(r => (r.title + r.beneficiary).toLowerCase().includes(search.toLowerCase()))
    if (dateStart && dateEnd) arr = arr.filter(r => {
      const d = new Date(r.created_at); const s = new Date(dateStart); const e = new Date(dateEnd)
      s.setHours(0,0,0,0); e.setHours(23,59,59,999); return d >= s && d <= e
    })
    if (geoFilter.operation || geoFilter.division || geoFilter.region || geoFilter.area || geoFilter.branchCode) {
      arr = arr.filter(r => {
        let bCode = ''
        if (r.type === 'Branch Request') {
          bCode = (r.beneficiary || '').split(' - ')[0].trim().toUpperCase()
        } else {
          const staff = staffMap[String(r.beneficiary).toLowerCase()]
          bCode = String(staff?.branch_code || '').trim().toUpperCase()
        }

        const bDet = branchMap[bCode]
        if (!bDet) return false

        if (geoFilter.operation && bDet.operation !== geoFilter.operation) return false
        if (geoFilter.division && bDet.division !== geoFilter.division) return false
        if (geoFilter.region && bDet.region !== geoFilter.region) return false
        if (geoFilter.area && bDet.area !== geoFilter.area) return false
        if (geoFilter.branchCode && bCode !== geoFilter.branchCode) return false
        return true
      })
    }
    arr.sort((a, b) => {
      const av = a[sortKey] ?? ''; const bv = b[sortKey] ?? ''
      const cmp = typeof av === 'number' ? av - bv : String(av).localeCompare(String(bv))
      return sortDir === 'asc' ? cmp : -cmp
    })
    return arr
  }, [allRequests, status, search, dateStart, dateEnd, geoFilter, sortKey, sortDir, staffMap, branchMap])

  const paged = filtered.slice((page - 1) * ROWS_PER_PAGE, page * ROWS_PER_PAGE)
  const totalAmount = filtered.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0)

  const openModal = (rec = null) => {
    setEditing(rec)
    const today = new Date().toISOString().split('T')[0]
    setForm(rec 
      ? { type: rec.type, beneficiary: rec.beneficiary, date_req: rec.date_req, title: rec.title, description: rec.description, amount: rec.amount } 
      : { type: 'Staff Request', beneficiary: '', date_req: today, title: '', description: '', amount: '' }
    )
    setShowModal(true)
  }

  const handleSave = async () => {
    if (!form.date_req || !form.beneficiary || !form.title) return Swal.fire('Error', 'Missing required fields', 'error')
    try {
      if (editing) {
        await updateReq.mutateAsync({ reqId: editing.req_id, updates: { type: form.type, beneficiary: form.beneficiary, date_req: form.date_req, title: form.title, description: form.description, amount: form.amount } })
        Swal.fire('Updated!', '', 'success')
      } else {
        await createReq.mutateAsync({ ...form, reqId: Date.now().toString() })
        Swal.fire('Submitted!', '', 'success')
      }
      setShowModal(false)
    } catch (err) { Swal.fire('Error', err.message, 'error') }
  }

  const handleDelete = (rec) => {
    Swal.fire({ title: 'Delete?', icon: 'warning', showCancelButton: true, confirmButtonColor: '#ef4444', confirmButtonText: 'Yes, delete' })
      .then(r => { if (r.isConfirmed) deleteReq.mutateAsync(rec.req_id).then(() => Swal.fire('Deleted!', '', 'success')).catch(e => Swal.fire('Error', e.message, 'error')) })
  }

  const handleBatchDelete = async () => {
    if (!selected.length) return Swal.fire('Info', 'No items selected', 'info')
    const result = await Swal.fire({ title: `Delete ${selected.length} item(s)?`, text: 'Cannot be undone.', icon: 'warning', showCancelButton: true, confirmButtonColor: '#ef4444', confirmButtonText: 'Yes, delete' })
    if (!result.isConfirmed) return
    try {
      for (const id of selected) await deleteReq.mutateAsync(id)
      setSelected([])
      Swal.fire('Deleted!', '', 'success')
    } catch (err) { Swal.fire('Error', err.message, 'error') }
  }

  const handleProcess = async (action, payload, record) => {
    setOpsTarget(null)
    try {
      await processReq.mutateAsync({ reqId: record.req_id, action, payload })
      Swal.fire('Success', 'Processed', 'success')
    } catch (err) { Swal.fire('Error', err.message, 'error') }
  }

  const handleUpload = async (rec) => {
    const input = document.createElement('input'); input.type = 'file'
    input.accept = '.pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg'
    input.onchange = async (e) => {
      const file = e.target.files[0]; if (!file) return
      try {
        Swal.fire({ title: 'Uploading...', allowOutsideClick: false, didOpen: () => Swal.showLoading() })
        const result = await uploadToDrive(file)
        await attachFile.mutateAsync({ reqId: rec.req_id, fileId: result.fileId })
        Swal.fire('Uploaded!', '', 'success')
      } catch (err) { Swal.fire('Error', err.message, 'error') }
    }
    input.click()
  }

  const resolveRequestEmail = (rec) => {
    const beneficiary = String(rec.beneficiary || '').trim()
    let bCode = String(rec.branch_code || '').trim().toUpperCase()
    let staffEmail = ''

    if (!bCode && rec.type === 'Branch Request') {
      bCode = beneficiary.split(' - ')[0].trim().toUpperCase()
    }

    if (!bCode) {
      const beneficiaryKey = beneficiary.toLowerCase()
      const staff = staffList.find(s =>
        (s.name && s.name.toLowerCase() === beneficiaryKey) ||
        (`${s.first_name || ''} ${s.last_name || ''}`.trim().toLowerCase() === beneficiaryKey)
      )
      bCode = String(staff?.branch_code || '').trim().toUpperCase()
      const emp = employeeList.find(e => String(e.full_name || '').toLowerCase() === beneficiaryKey)
      staffEmail = staff?.email || emp?.email_address || ''
    }

    const branchEmail = branchEmailMap[bCode] || branchMap[bCode]?.email || ''
    const operationEmail = OPERATION_EMAIL_MAP[branchMap[bCode]?.operation] || ''

    return branchEmail || staffEmail || operationEmail
  }

  const handleSendEmail = (rec) => {
    const receiverEmail = resolveRequestEmail(rec)

    navigate('/send-email', {
      state: {
        draft: {
          to: receiverEmail ? [receiverEmail] : [],
          subject: `${rec.title || 'Request Letter'} - ${rec.beneficiary || rec.req_id} (Checked)`,
          note: `Request letter for ${rec.beneficiary || rec.req_id} has been checked. Amount: ${fmtCurrency(rec.amount)}.`,
          refId: rec.req_id,
          refType: 'Request Letter',
          fileId: rec.file_id || '',
        },
      },
    })
  }

  const handleBatchSendEmail = () => {
    const eligible = filtered.filter(r => selected.includes(r.req_id) && normalizeRequestStatus(r.status) === 'Checked');
    if (!eligible.length) return Swal.fire('Info', 'Select checked items first', 'info');
    
    const emails = eligible.map(resolveRequestEmail).filter(Boolean)

    navigate('/send-email', {
      state: {
        draft: {
          to: [...new Set(emails)],
          subject: `Checked Request Letters Batch (${eligible.length} items)`,
          note: `Attached are the checked request letters. Total Amount: ${fmtCurrency(eligible.reduce((s, r) => s + Number(r.amount || 0), 0))}.`,
          refId: eligible.map(r => r.req_id).join(','),
          refType: 'Request Letter Batch',
        },
      },
    })
  }

  const handleBatchProcess = async (action) => {
    if (!selected.length) return Swal.fire('Info', 'No items selected', 'info')
    const requiredStatus = action === 'OPS_CHECK' ? 'Pending' : 'Checked'
    const eligible = filtered.filter(r => selected.includes(r.req_id) && r.status === requiredStatus)
    if (!eligible.length) return Swal.fire('Info', 'No eligible items for this action', 'info')
    const result = await Swal.fire({ title: `Process ${eligible.length} item(s)?`, icon: 'question', showCancelButton: true, confirmButtonText: 'Yes' })
    if (!result.isConfirmed) return
    try {
      await Promise.all(eligible.map(r => processReq.mutateAsync({ reqId: r.req_id, action, payload: {} })))
      setSelected([])
      Swal.fire('Done!', `Processed ${eligible.length} items.`, 'success')
    } catch (err) { Swal.fire('Error', err.message, 'error') }
  }

  const exportCSV = () => {
    const rows = [['Date', 'Type', 'Beneficiary', 'Title', 'Description', 'Amount', 'Status'],
      ...filtered.map(r => [r.date_req, r.type, r.beneficiary, r.title, r.description, r.amount, r.status])]
    const csv = rows.map(row => row.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n')
    const a = document.createElement('a'); a.href = 'data:text/csv;charset=utf-8,\uFEFF' + encodeURIComponent(csv)
    a.download = `requests_${new Date().toISOString().split('T')[0]}.csv`; a.click()
  }

  const handleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
    setPage(1)
  }

  const SortIcon = ({ k }) => sortKey === k
    ? <i className={`fas fa-sort-${sortDir === 'asc' ? 'up' : 'down'} text-blue-500 text-xs ml-1`} />
    : <i className="fas fa-sort text-gray-300 text-xs ml-1" />

  const selectOptions = (items) => items.map(item => ({ value: item, label: item }))

  const summaryCards = [
    {
      label: 'Total Records',
      value: filtered.length,
      icon: Archive,
      tone: 'from-slate-700 to-slate-900',
      sub: `${paged.length} visible on this page`,
    },
    {
      label: 'Total Amount',
      value: fmtCurrency(filtered.reduce((sum, r) => sum + Number(r.amount || 0), 0)),
      icon: CircleDollarSign,
      tone: 'from-emerald-600 to-teal-700',
      sub: 'Filtered request value',
    },
    {
      label: 'Pending',
      value: filtered.filter(r => r.status === 'Pending').length,
      icon: CalendarDays,
      tone: 'from-amber-500 to-orange-600',
      sub: 'Awaiting operations check',
    },
    {
      label: 'Checked',
      value: filtered.filter(r => normalizeRequestStatus(r.status) === 'Checked').length,
      icon: ShieldCheck,
      tone: 'from-sky-600 to-blue-700',
      sub: 'Ready for email release',
    },
  ]

  const setGeo = (key, val) => {
    setGeoFilter(prev => {
      const next = { ...prev, [key]: val }
      if (key === 'operation') { next.division = ''; next.region = ''; next.area = ''; next.branchCode = '' }
      if (key === 'division')  { next.region = ''; next.area = ''; next.branchCode = '' }
      if (key === 'region')    { next.area = ''; next.branchCode = '' }
      if (key === 'area')      { next.branchCode = '' }
      return next
    })
    setPage(1)
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <section className="relative overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700/70 dark:bg-slate-900/70">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-sky-500 via-emerald-500 to-amber-400" />
        <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-5 lg:px-6">
          <div className="flex min-w-0 items-center gap-4">
            <div className="flex h-12 w-12 flex-none items-center justify-center rounded-xl bg-sky-50 text-sky-700 ring-1 ring-sky-100 dark:bg-sky-400/10 dark:text-sky-200 dark:ring-sky-300/20">
              <FileText size={24} />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-bold text-gray-950 dark:text-gray-100">Request Letters</h1>
                <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                  {filtered.length} records
                </span>
              </div>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Manage request submissions, checking, attachments, and email releases.</p>
            </div>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
          {selected.length > 0 && (
            <>
              {canCheck && <button onClick={() => handleBatchProcess('OPS_CHECK')} className="btn-primary inline-flex items-center gap-2 text-xs px-3 py-2"><CheckCheck size={15} />Check ({selected.length})</button>}
              {isAdmin && <button onClick={handleBatchDelete} className="btn-danger inline-flex items-center gap-2 text-xs px-3 py-2"><Trash2 size={15} />Delete ({selected.length})</button>}
            </>
          )}
          <button onClick={exportCSV} className="btn-secondary inline-flex items-center gap-2 text-xs px-3 py-2"><Download size={15} className="text-emerald-600" />Export</button>
          {canUpload && <button onClick={() => openModal()} className="btn-primary inline-flex items-center gap-2 text-xs px-3 py-2"><FilePlus2 size={15} />New Request</button>}
          </div>
        </div>
      </section>

      <section>
        {selected.length > 0 && (
          <div className="flex justify-end mb-4">
            <button onClick={handleBatchSendEmail} className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-amber-600">
              <Mail size={15} />Email Selected ({selected.length})
            </button>
          </div>
        )}
      </section>
      

      {/* Scorecard */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map(card => {
          const Icon = card.icon
          return (
            <div key={card.label} className={`relative overflow-hidden rounded-xl bg-gradient-to-br ${card.tone} p-4 text-white shadow-sm`}>
              <div className="absolute right-3 top-3 rounded-xl bg-white/12 p-2 ring-1 ring-white/15">
                <Icon size={18} />
              </div>
              <div className="pr-10 text-xs font-bold uppercase tracking-wide text-white/75">{card.label}</div>
              <div className="mt-2 truncate text-2xl font-bold">{card.value}</div>
              <div className="mt-1 text-xs text-white/70">{card.sub}</div>
            </div>
          )
        })}
      </div>

      {/* Filters */}
      <div className="card overflow-hidden">
        <div className="flex items-center gap-2 border-b border-gray-100 bg-gray-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/40">
          <Filter size={16} className="text-sky-600 dark:text-sky-300" />
          <div className="text-sm font-bold text-gray-800 dark:text-gray-100">Filters</div>
          <div className="ml-auto text-xs font-semibold text-gray-500 dark:text-gray-400">{fmtCurrency(totalAmount)} filtered total</div>
        </div>
        <div className="p-4">
        <div className="flex flex-wrap gap-3 items-center mb-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input className="input pl-9 text-sm" placeholder="Search by title, beneficiary..." value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} />
          </div>
          <div className="text-right border-l border-gray-200 pl-3 dark:border-slate-700">
            <div className="text-xs text-gray-400 uppercase font-semibold">Total Amount</div>
            <div className="text-lg font-bold text-blue-600">{fmtCurrency(totalAmount)}</div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <select className="input text-sm py-1.5 w-auto" value={status} onChange={e => { setStatus(e.target.value); setPage(1) }}>
            <option value="All">All Status</option>
            {['Pending','Checked','Rejected'].map(s => <option key={s}>{s}</option>)}
          </select>
          <input type="date" className="input text-sm py-1.5 w-auto" value={dateStart} onChange={e => { setDateStart(e.target.value); setPage(1) }} />
          <span className="text-gray-400 self-center">to</span>
          <input type="date" className="input text-sm py-1.5 w-auto" value={dateEnd} onChange={e => { setDateEnd(e.target.value); setPage(1) }} />
          <SegmentedSearchSelect label="Operation" value={geoFilter.operation} options={selectOptions(geoLists.operations)} onChange={value => setGeo('operation', value)} />
          <SegmentedSearchSelect label="Division" value={geoFilter.division} options={selectOptions(geoLists.divisions)} onChange={value => setGeo('division', value)} />
          <SegmentedSearchSelect label="Region" value={geoFilter.region} options={selectOptions(geoLists.regions)} onChange={value => setGeo('region', value)} />
          <SegmentedSearchSelect label="Area" value={geoFilter.area} options={selectOptions(geoLists.areas)} onChange={value => setGeo('area', value)} />
          <SegmentedSearchSelect
            label="Branch"
            value={geoFilter.branchCode}
            options={geoLists.branchesOptions}
            onChange={value => setGeo('branchCode', value)}
            placeholder="All"
            className="w-[260px]"
          />
          <button onClick={() => { setSearch(''); setStatus('All'); setDateStart(''); setDateEnd(''); setGeoFilter({ operation:'',division:'',region:'',area:'',branchCode:'' }); setPage(1) }} className="btn-secondary inline-flex items-center gap-1.5 text-xs px-3 py-1.5"><X size={14} />Clear</button>
        </div>
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 px-4 py-3 dark:border-slate-800">
          <div>
            <div className="text-sm font-bold text-gray-900 dark:text-gray-100">Request Registry</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Sorted by {sortKey.replace('_', ' ')} ({sortDir})</div>
          </div>
          {selected.length > 0 && (
            <div className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 dark:bg-sky-400/10 dark:text-sky-200">
              {selected.length} selected
            </div>
          )}
        </div>
        <div className="overflow-x-auto overflow-y-auto max-h-[70vh]">
          <table className="w-full min-w-[1320px] table-fixed">
            <thead className="sticky top-0 z-20 bg-white dark:bg-slate-900 shadow-sm">
              <tr>
                <th className="table-th w-10"><input type="checkbox" className="rounded" checked={paged.length > 0 && paged.every(r => selected.includes(r.req_id))} onChange={e => setSelected(e.target.checked ? [...new Set([...selected, ...paged.map(r => r.req_id)])] : selected.filter(id => !paged.map(r => r.req_id).includes(id)))} /></th>
                <th className="table-th w-12">#</th>
                {[['created_at','Date Uploaded'],['type','Type'],['title','Title / Beneficiary'],['description','Description'],['amount','Amount'],['status','Status']].map(([k,l]) => (
                  <th key={k} className={`table-th cursor-pointer ${
                    k === 'created_at' ? 'w-44' :
                    k === 'type' ? 'w-36' :
                    k === 'title' ? 'w-64' :
                    k === 'description' ? 'w-48' :
                    'w-32'
                  }`} onClick={() => { handleSort(k); setPage(1) }}>
                    {l}<SortIcon k={k} />
                  </th>
                ))}
                <th className="table-th w-44">Uploader</th>

                <th className="table-th text-right w-56">Actions</th>
              </tr>
            </thead>
            <tbody>
                                    {isLoading ? <TableLoader /> : paged.length === 0 ? <EmptyRow cols={11} /> :

                paged.map((r, idx) => {
                  const uploadedAt = getUploadedAt(r)
                  const displayStatus = normalizeRequestStatus(r.status)
                  return (
                  <tr key={r.req_id} className="table-tr">
                    <td className="table-td"><input type="checkbox" className="rounded" checked={selected.includes(r.req_id)} onChange={e => setSelected(e.target.checked ? [...selected, r.req_id] : selected.filter(id => id !== r.req_id))} /></td>
                    <td className="table-td text-gray-400 text-xs">{(page-1)*ROWS_PER_PAGE+idx+1}</td>
                    <td className="table-td text-sm whitespace-nowrap">
                      <div className="font-semibold text-sm">
                        {uploadedAt ? uploadedAt.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' }) : '-'}
                      </div>
                      <div className="text-xs text-gray-400">
                        {uploadedAt ? uploadedAt.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' }) : ''}
                      </div>
                    </td>
                    <td className="table-td"><span className="badge badge-checked text-xs">{r.type}</span></td>
                    <td className="table-td min-w-0"><div className="font-semibold text-sm truncate" title={r.title}>{r.title}</div><div className="text-xs text-gray-400 truncate" title={r.beneficiary}>{r.beneficiary}</div></td>
                    <td className="table-td"><div className="text-xs text-gray-500 max-w-[120px] truncate">{r.description || '-'}</div></td>
                    <td className="table-td font-semibold whitespace-nowrap">{fmtCurrency(r.amount)}</td>
                    <td className="table-td whitespace-nowrap"><StatusBadge status={displayStatus} remarks={r.remarks} /></td>
                    <td className="table-td text-xs" dangerouslySetInnerHTML={{ __html: r.uploader_info || r.uploader || '-' }} />

                    <td className="table-td">
                      <div className="table-actions">
                        <button onClick={() => r.file_id && setPreviewFile(r.file_id)} className={`btn-icon ${r.file_id ? 'bg-cyan-50 text-cyan-600 hover:bg-cyan-100' : 'bg-gray-50 text-gray-300 cursor-not-allowed'}`} title={r.file_id ? 'Preview' : 'No attachment'}><i className="fas fa-eye" /></button>
                        {canUpload && <><button onClick={() => handleSendEmail(r)} className="btn-icon bg-amber-50 text-amber-500 hover:bg-amber-100" title="Send Email" disabled={displayStatus !== 'Checked'}><i className="fas fa-envelope" /></button><button onClick={() => openModal(r)} className="btn-icon bg-gray-50 text-gray-500 hover:bg-gray-100" title="Edit"><i className="fas fa-pencil-alt" /></button></>}
                        {displayStatus === 'Pending' && canCheck && <button onClick={() => setOpsTarget(r)} className="btn-icon bg-blue-50 text-blue-600 hover:bg-blue-100" title="Check"><i className="fas fa-check" /></button>}

                        {isAdmin && displayStatus !== 'Checked' && <button onClick={() => handleDelete(r)} className="btn-icon bg-red-50 text-red-500 hover:bg-red-100" title="Delete"><i className="fas fa-trash" /></button>}
                      </div>
                    </td>
                  </tr>
                  )
                })
              }
              {/* Total row */}
              {paged.length > 0 && (
                <tr className="bg-gray-50 dark:bg-slate-800/50 font-semibold">
                  <td className="table-td" colSpan={6}>
                    <span className="text-sm text-gray-700 dark:text-gray-200">Total ({paged.length} rows on this page)</span>
                  </td>
                  <td className="table-td font-bold text-gray-900 dark:text-gray-100 text-sm">
                    {fmtCurrency(paged.reduce((sum, r) => sum + Number(r.amount || 0), 0))}
                  </td>
                  <td className="table-td" colSpan={4}></td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <Pagination page={page} total={filtered.length} onChange={setPage} />
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="modal-backdrop" onClick={() => setShowModal(false)}>
          <div className="modal-panel max-w-md" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title"><i className="fas fa-file-contract text-sky-200" />{editing ? 'Edit Request' : 'New Request'}</h3>
              <p className="modal-subtitle">Encode staff or branch request details</p>
            </div>
            <div className="modal-body space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Type</label>
                  <select className="input" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value, beneficiary: '' }))}>
                    <option>Staff Request</option><option>Branch Request</option>
                  </select>
                </div>
                <div>
                  <label className="label">Date</label>
                  <input type="date" className="input" value={form.date_req} onChange={e => setForm(f => ({ ...f, date_req: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="label">Beneficiary</label>
                {form.type === 'Branch Request' ? (
                  <div className="grid grid-cols-2 gap-2">
                    <div className="relative">
                      <input
                        className="input text-sm font-semibold uppercase"
                        placeholder="Code (e.g. B0001)"
                        value={form.beneficiary.split(' - ')[0] || ''}
                        onFocus={() => setBranchLookupOpen(true)}
                        onBlur={() => setTimeout(() => setBranchLookupOpen(false), 200)}
                        onChange={e => {
                          const code = e.target.value.toUpperCase().replace(/O/g, '0')
                          setForm(f => ({ ...f, beneficiary: code }))
                          setBranchLookupOpen(true)
                        }}
                      />
                      {branchLookupOpen && (
                        <div className="absolute left-0 right-0 top-full z-40 mt-1 max-h-72 overflow-y-auto rounded-xl border border-blue-500 bg-white shadow-xl">
                          {(() => {
                            const needle = String(form.beneficiary.split(' - ')[0] || '').trim().toLowerCase()
                            const matches = (needle ? branchOptions.filter(branch => `${branch.value} ${branch.label}`.toLowerCase().includes(needle)) : branchOptions).slice(0, 10)
                            return matches.length === 0 ? (
                              <div className="px-4 py-3 text-sm text-slate-500">No branch found</div>
                            ) : matches.map(branch => (
                              <button
                                key={branch.value}
                                type="button"
                                className="grid w-full grid-cols-[72px_1fr] gap-2 border-b border-slate-100 px-4 py-2.5 text-left text-sm transition last:border-b-0 hover:bg-blue-50"
                                onMouseDown={event => {
                                  event.preventDefault()
                                  setForm(f => ({ ...f, beneficiary: branch.label }))
                                  setBranchLookupOpen(false)
                                }}
                              >
                                <span className="font-bold text-blue-700">{branch.value}</span>
                                <span className="text-slate-600 truncate">{branch.label.split(' - ').slice(1).join(' - ')}</span>
                              </button>
                            ))
                          })()}
                        </div>
                      )}
                    </div>
                    <div>
                      <input className="input text-sm text-rose-700 font-semibold" readOnly value={form.beneficiary.includes(' - ') ? form.beneficiary.split(' - ').slice(1).join(' - ') : ''} placeholder="Branch Name" />
                    </div>
                  </div>
                ) : (
                  <>
                    <input className="input" list="benList" placeholder="Name..." value={form.beneficiary} onChange={e => setForm(f => ({ ...f, beneficiary: e.target.value }))} />
                    <datalist id="benList">
                      {staffList.map(s => <option key={s.id} value={s.name} />)}
                    </datalist>
                  </>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Title</label>
                  <select className="input" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}>
                    <option value="">Select...</option>
                    {titles.map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Amount (PHP)</label>
                  <input type="number" className="input" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="label">Description</label>
                <textarea className="input resize-none" rows={3} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
              </div>
              <div className="flex gap-2 mt-5 justify-end">
              <button onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>
              <button onClick={handleSave} disabled={createReq.isPending || updateReq.isPending} className="btn-primary">
                {editing ? 'Update' : 'Submit'}
              </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {opsTarget && <OpsModal record={opsTarget} onConfirm={(action, payload) => handleProcess(action, payload, opsTarget)} onClose={() => setOpsTarget(null)} />}
      {previewFile && <FilePreviewModal fileId={previewFile} onClose={() => setPreviewFile(null)} />}
    </div>
  )
}
