import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSbar, useCreateSbar, useUpdateSbar, useDeleteSbar, useProcessSbar } from '../hooks/useSbar'
import { useSettings } from '../hooks/useAccounts'
import { useBranches, useBranchMap, useBranchOptions, useBranchEmailMap } from '../hooks/useBranches'
import { useAuthStore } from '../store/authStore'
// Mapping of operations to recipient email addresses
const OPERATION_EMAIL_MAP = {
  "LUZON I": "jinnette.anacio@asaphil.org",
  "LUZON II": "cynthia.casido@asaphil.org",
  "VISAYAS I": "jonnie.borgonia@asaphil.org",
  "VISAYAS II": "sharon.galeno@asaphil.org",
  "MINDANAO I": "taib.abduraji@asaphil.org",
  "MINDANAO II": "arlyn.yagaya@asaphil.org",
};
import { uploadToDrive } from '../lib/gas'
import { supabase } from '../lib/supabase'
import { fmtNum, fmtCurrency, fmtDate, getUploadedAt, ROWS_PER_PAGE } from '../lib/utils'
import StatusBadge from '../components/shared/StatusBadge'
import { OpsModal } from '../components/shared/ProcessModal'
import FilePreviewModal from '../components/shared/FilePreviewModal'
import Pagination from '../components/shared/Pagination'
import { TableLoader, EmptyRow } from '../components/shared/Loader'
import SegmentedSearchSelect from '../components/shared/SegmentedSearchSelect'
import Swal from 'sweetalert2'

export default function Sbar() {
  const { canCheck, canUpload, isAdmin } = useAuthStore()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('All')
  const [type, setType] = useState('All')
  const [dateStart, setDateStart] = useState('')
  const [dateEnd, setDateEnd] = useState('')
  const [geoFilter, setGeoFilter] = useState({ operation: '', division: '', region: '', area: '', branchCode: '' })
  const [selected, setSelected] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [opsTarget, setOpsTarget] = useState(null)
  const [previewFile, setPreviewFile] = useState(null)
  const [sortKey, setSortKey] = useState('created_at')
  const [sortDir, setSortDir] = useState('desc')
  const [giverLookupOpen, setGiverLookupOpen] = useState(false)
  const [receiverLookupOpen, setReceiverLookupOpen] = useState(false)

  const { data: allSbar = [], isLoading } = useSbar()
  const { data: settings } = useSettings()
  const createSbar = useCreateSbar()
  const updateSbar = useUpdateSbar()
  const deleteSbar = useDeleteSbar()
  const processSbar = useProcessSbar()
  const { data: branches = [] } = useBranches()
  const branchMap = useBranchMap()
  const branchOptions = useBranchOptions()
  const branchEmailMap = useBranchEmailMap()
  const navigate = useNavigate()
  const titles = settings?.titles || []

  const handleSendEmail = (rec) => {
    const giverCode = (rec.giver || '').split(' - ')[0].trim().toUpperCase()
    const gDet = branchMap[giverCode] || {}
    
    // Auto-detect based on Giver's Operation (Case-insensitive lookup)
    const opKey = String(gDet.operation || '').toUpperCase()
    const opEmail = OPERATION_EMAIL_MAP[opKey] || branchEmailMap[giverCode]

    const emails = opEmail ? [opEmail] : []
    
    navigate('/send-email', {
      state: {
        draft: {
          to: emails,
          subject: `${rec.type || 'SBAR'} - ${rec.giver} to ${rec.receiver}`,
          note: `Approved ${rec.type || 'SBAR'} from ${rec.giver} to ${rec.receiver}. Amount: ${fmtCurrency(rec.amount)}.`,
          refId: rec.uniq_id,
          refType: rec.type || 'SBAR',
          fileId: rec.file_id || '',
        },
      },
    });
  }

  const handleBatchSendEmail = () => {
    const eligible = filtered.filter(r => selected.includes(r.uniq_id) && r.status === 'Approved')
    if (!eligible.length) return Swal.fire('Info', 'Select approved items first', 'info')

    const emails = eligible.flatMap(r => {
      const gCode = (r.giver || '').split(' - ')[0].trim().toUpperCase()
      const gDet = branchMap[gCode] || {}
      const opKey = String(gDet.operation || '').toUpperCase()
      return OPERATION_EMAIL_MAP[opKey] || branchEmailMap[gCode]
    }).filter(Boolean)

    navigate('/send-email', {
      state: {
        draft: {
          to: [...new Set(emails)], // Use Set to get unique emails
          subject: `Approved SBAR / Budget Transfer Batch (${eligible.length} items)`,
          note: `Attached are the approved SBAR / Budget Transfer records. Total Amount: ${fmtCurrency(eligible.reduce((s, r) => s + Number(r.amount || 0), 0))}.`,
          refId: eligible.map(r => r.uniq_id).join(','),
          refType: 'SBAR / Budget Transfer Batch',
        },
      },
    })
  }

  const EMPTY_FORM = { type: 'SBAR', date: '', giverCode: '', giverName: '', receiverCode: '', receiverName: '', giverTitle: '', receiverTitle: '', description: '', amount: '' }
  const [form, setForm] = useState(EMPTY_FORM)

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

  const filtered = useMemo(() => {
    let arr = [...allSbar]
    if (status !== 'All') arr = arr.filter(r => r.status === status)
    if (type !== 'All')   arr = arr.filter(r => r.type === type)
    if (search) arr = arr.filter(r => (r.giver + r.receiver).toLowerCase().includes(search.toLowerCase()))
    if (dateStart && dateEnd) arr = arr.filter(r => {
      const d = new Date(r.created_at); const s = new Date(dateStart); const e = new Date(dateEnd)
      s.setHours(0,0,0,0); e.setHours(23,59,59,999); return d >= s && d <= e
    })
    if (geoFilter.operation || geoFilter.division || geoFilter.region || geoFilter.area || geoFilter.branchCode) {
      arr = arr.filter(r => {
        const bCode = (r.giver || '').split(' - ')[0].trim().toUpperCase()
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
  }, [allSbar, status, type, search, dateStart, dateEnd, geoFilter, sortKey, sortDir, branchMap])

  const paged = filtered.slice((page-1)*ROWS_PER_PAGE, page*ROWS_PER_PAGE)

  const openModal = (rec = null) => {
    setEditing(rec)
    if (rec) {
      const g = (rec.giver || '').split(' - ')
      const r2 = (rec.receiver || '').split(' - ')
      setForm({ type: rec.type, date: rec.date, giverCode: g[0] || '', giverName: g.slice(1).join(' - '), receiverCode: r2[0] || '', receiverName: r2.slice(1).join(' - '), giverTitle: rec.giver_title || '', receiverTitle: rec.receiver_title || '', description: rec.description, amount: rec.amount })
    } else {
      const today = new Date().toISOString().split('T')[0]
      setForm({ ...EMPTY_FORM, date: today })
    }
    setShowModal(true)
  }

  const autoFillBranch = (codeKey, nameKey) => {
    const code = form[codeKey]?.trim().toUpperCase()
    if (!code) return
    branchOptions.find(b => b.value === code) && setForm(f => ({ ...f, [nameKey]: branchOptions.find(b => b.value === code)?.label?.split(' - ').slice(1).join(' - ') || '' }))
  }

  const handleSave = async () => {
    if (!form.date || !form.giverCode || !form.receiverCode || !form.amount || !form.giverTitle || !form.receiverTitle)
      return Swal.fire('Error', 'Missing required fields', 'error')
    try {
      const payload = {
        type: form.type, date: form.date,
        giver: `${form.giverCode} - ${form.giverName}`,
        receiver: `${form.receiverCode} - ${form.receiverName}`,
        giverTitle: form.giverTitle, receiverTitle: form.receiverTitle,
        description: form.description, amount: form.amount
      }
      if (editing) {
        await updateSbar.mutateAsync({ uniqId: editing.uniq_id, updates: payload })
        Swal.fire('Updated!', '', 'success')
      } else {
        await createSbar.mutateAsync({ ...payload, uniqId: Date.now().toString() })
        Swal.fire('Created!', '', 'success')
      }
      setShowModal(false)
    } catch (err) { Swal.fire('Error', err.message, 'error') }
  }

  const handleDelete = (rec) => {
    Swal.fire({ title: 'Delete SBAR?', icon: 'warning', showCancelButton: true, confirmButtonColor: '#ef4444', confirmButtonText: 'Yes' })
      .then(r => { if (r.isConfirmed) deleteSbar.mutateAsync(rec.uniq_id).then(() => Swal.fire('Deleted!', '', 'success')) })
  }

  const handleBatchProcess = async (action) => {
    if (!selected.length) return Swal.fire('Info', 'No items selected', 'info')
    const requiredStatus = action === 'OPS_CHECK' ? 'Pending' : 'Checked'
    const eligible = filtered.filter(r => selected.includes(r.uniq_id) && r.status === requiredStatus)
    if (!eligible.length) return Swal.fire('Info', 'No eligible items for this action', 'info')
    const result = await Swal.fire({ title: `Process ${eligible.length} item(s)?`, icon: 'question', showCancelButton: true, confirmButtonText: 'Yes' })
    if (!result.isConfirmed) return
    try {
      await Promise.all(eligible.map(r => processSbar.mutateAsync({ uniqId: r.uniq_id, action, payload: {} })))
      setSelected([])
      Swal.fire('Done!', `Processed ${eligible.length} items.`, 'success')
    } catch (err) { Swal.fire('Error', err.message, 'error') }
  }

  const handleBatchDelete = async () => {
    if (!selected.length) return Swal.fire('Info', 'No items selected', 'info')
    const result = await Swal.fire({ title: `Delete ${selected.length} item(s)?`, text: 'Cannot be undone.', icon: 'warning', showCancelButton: true, confirmButtonColor: '#ef4444', confirmButtonText: 'Yes, delete' })
    if (!result.isConfirmed) return
    try {
      for (const id of selected) await deleteSbar.mutateAsync(id)
      setSelected([])
      Swal.fire('Deleted!', '', 'success')
    } catch (err) { Swal.fire('Error', err.message, 'error') }
  }

  const handleProcess = async (action, payload, record) => {
    setOpsTarget(null)
    try {
      await processSbar.mutateAsync({ uniqId: record.uniq_id, action, payload })
      Swal.fire('Success', 'Processed', 'success')
    } catch (err) { Swal.fire('Error', err.message, 'error') }
  }

  const handleUpload = async (rec) => {
    const input = document.createElement('input'); input.type = 'file'
    input.onchange = async (e) => {
      const file = e.target.files[0]; if (!file) return
      try {
        Swal.fire({ title: 'Uploading...', allowOutsideClick: false, didOpen: () => Swal.showLoading() })
        const result = await uploadToDrive(file)
        await supabase.from('sbar').update({ file_id: result.fileId }).eq('uniq_id', rec.uniq_id)
        Swal.fire('Uploaded!', '', 'success')
      } catch (err) { Swal.fire('Error', err.message, 'error') }
    }
    input.click()
  }

  const exportCSV = () => {
    const rows = [['Date','Type','Giver','Receiver','Giver Title','Receiver Title','Description','Amount','Status'],
      ...filtered.map(r => [r.date,r.type,r.giver,r.receiver,r.giver_title,r.receiver_title,r.description,r.amount,r.status])]
    const csv = rows.map(row => row.map(v => `"${String(v??'').replace(/"/g,'""')}"`).join(',')).join('\n')
    const a = document.createElement('a'); a.href = 'data:text/csv;charset=utf-8,\uFEFF'+encodeURIComponent(csv)
    a.download = `sbar_${new Date().toISOString().split('T')[0]}.csv`; a.click()
  }

  const handleSort = (key) => { if (sortKey === key) setSortDir(d => d==='asc'?'desc':'asc'); else { setSortKey(key); setSortDir('asc') }; setPage(1) }
  const SortIcon = ({ k }) => sortKey === k ? <i className={`fas fa-sort-${sortDir==='asc'?'up':'down'} text-blue-500 text-xs ml-1`} /> : <i className="fas fa-sort text-gray-300 text-xs ml-1" />
  const selectOptions = (items) => items.map(item => ({ value: item, label: item }))

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">SBAR / Budget Transfer</h1>
          <p className="text-sm text-gray-500">Manage budget transfers and SBAR requests</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {selected.length > 0 && (
            <>
              {canCheck && <button onClick={() => handleBatchProcess('OPS_CHECK')} className="btn-primary text-xs px-3 py-2"><i className="fas fa-check-double mr-1" />Check ({selected.length})</button>}
              <button onClick={handleBatchSendEmail} className="btn-icon bg-amber-500 text-white text-xs px-3 py-2 rounded-lg"><i className="fas fa-envelope mr-1" />Email ({selected.length})</button>
              {isAdmin && <button onClick={handleBatchDelete} className="btn-danger text-xs px-3 py-2"><i className="fas fa-trash mr-1" />Delete ({selected.length})</button>}
            </>
          )}
          <button onClick={exportCSV} className="btn-secondary text-xs px-3 py-2"><i className="fas fa-file-excel mr-1 text-green-600" />Export</button>
          {canUpload && <button onClick={() => openModal()} className="btn-primary text-xs px-3 py-2"><i className="fas fa-plus mr-1" />New SBAR</button>}
        </div>
      </div>

      {/* Scorecard */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-4">
        <div className="bg-gradient-to-br from-gray-600 to-gray-700 rounded-xl p-4 text-white shadow-sm">
          <div className="text-xs font-bold opacity-80 uppercase tracking-wide">Total Records</div>
          <div className="text-2xl font-bold mt-1">{filtered.length}</div>
        </div>
        <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl p-4 text-white shadow-sm">
          <div className="text-xs font-bold opacity-80 uppercase tracking-wide">Total Amount</div>
          <div className="text-2xl font-bold mt-1">{fmtCurrency(filtered.reduce((sum, r) => sum + Number(r.amount || 0), 0))}</div>
        </div>
        <div className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-xl p-4 text-white shadow-sm">
          <div className="text-xs font-bold opacity-80 uppercase tracking-wide">Pending</div>
          <div className="text-2xl font-bold mt-1">{filtered.filter(r => r.status === 'Pending').length}</div>
        </div>
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-4 text-white shadow-sm">
          <div className="text-xs font-bold opacity-80 uppercase tracking-wide">Checked</div>
          <div className="text-2xl font-bold mt-1">{filtered.filter(r => r.status === 'Checked').length}</div>
        </div>
        {/* Removed Approved Scorecard */}
        {/* <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl p-4 text-white shadow-sm">
          <div className="text-xs font-bold opacity-80 uppercase tracking-wide">Approved</div>
          <div className="text-2xl font-bold mt-1">{filtered.filter(r => r.status === 'Approved').length}</div> */}
      </div>

      {/* Filters */}
      <div className="card p-4 mb-4">
        <div className="flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-[180px]">
            <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
            <input className="input pl-9 text-sm" placeholder="Search Giver or Receiver..." value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} />
          </div>
          <select className="input text-sm py-1.5 w-auto" value={type} onChange={e => { setType(e.target.value); setPage(1) }}>
            <option value="All">All Types</option><option>SBAR</option><option>Budget Transfer</option>
          </select>
          <select className="input text-sm py-1.5 w-auto" value={status} onChange={e => { setStatus(e.target.value); setPage(1) }}>
            <option value="All">All Status</option>
            {['Pending','Checked','Rejected'].map(s => <option key={s}>{s}</option>)}
          </select>
          <input type="date" className="input text-sm py-1.5 w-auto" value={dateStart} onChange={e => { setDateStart(e.target.value); setPage(1) }} />
          <span className="self-center text-gray-400">to</span>
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
          <button onClick={() => { setSearch(''); setStatus('All'); setType('All'); setDateStart(''); setDateEnd(''); setGeoFilter({ operation: '', division: '', region: '', area: '', branchCode: '' }); setPage(1) }} className="btn-secondary text-xs px-3 py-1.5">Clear</button>
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto overflow-y-auto max-h-[70vh] thick-scrollbar">
          <table className="w-full min-w-[1280px] table-fixed">
            <thead className="sticky top-0 z-20 bg-white dark:bg-slate-900 shadow-sm">
              <tr>
                <th className="table-th w-10"><input type="checkbox" className="rounded" checked={paged.length>0&&paged.every(r=>selected.includes(r.uniq_id))} onChange={e=>setSelected(e.target.checked?[...new Set([...selected,...paged.map(r=>r.uniq_id)])]:selected.filter(id=>!paged.map(r=>r.uniq_id).includes(id)))} /></th>
                <th className="table-th w-12">#</th>
                {[['created_at','Date Uploaded'],['type','Type']].map(([k,l])=>(
                  <th key={k} className={`table-th cursor-pointer sticky-header ${k === 'created_at' ? 'w-44' : 'w-32'}`} onClick={()=>handleSort(k)}>{l}<SortIcon k={k} /></th>
                ))}
                <th className="table-th w-64">Giver / Receiver</th>
                <th className="table-th w-44">Account Titles</th>
                <th className="table-th w-48">Description</th>
                <th className="table-th cursor-pointer sticky-header w-32" onClick={()=>handleSort('amount')}>Amount<SortIcon k="amount" /></th>
                <th className="table-th cursor-pointer sticky-header w-32" onClick={()=>handleSort('status')}>Status<SortIcon k="status" /></th>
                <th className="table-th w-44">Uploader</th>
                <th className="table-th hidden md:table-cell w-44">Checked By</th>

                <th className="table-th text-right w-56">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? <TableLoader /> : paged.length===0 ? <EmptyRow cols={13} /> :
                paged.map((r, idx) => {
                  const uploadedAt = getUploadedAt(r)
                  return (
                  <tr key={r.uniq_id} className="table-tr">
                    <td className="table-td"><input type="checkbox" className="rounded" checked={selected.includes(r.uniq_id)} onChange={e=>setSelected(e.target.checked?[...selected,r.uniq_id]:selected.filter(id=>id!==r.uniq_id))} /></td>
                    <td className="table-td text-gray-400 text-xs">{(page-1)*ROWS_PER_PAGE+idx+1}</td>
                    <td className="table-td text-sm whitespace-nowrap">
                      <div className="font-semibold text-sm">
                        {uploadedAt ? uploadedAt.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' }) : '—'}
                      </div>
                      <div className="text-xs text-gray-400">
                        {uploadedAt ? uploadedAt.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' }) : ''}
                      </div>
                    </td>
                    <td className="table-td"><span className="badge badge-checked text-xs">{r.type}</span></td>
                    <td className="table-td text-sm min-w-0">
                      <div className="font-semibold truncate" title={r.giver}>{r.giver}</div>
                      <div className="flex items-center gap-1 text-gray-400 text-xs my-0.5"><i className="fas fa-arrow-down text-[9px]" /></div>
                      <div className="font-semibold truncate" title={r.receiver}>{r.receiver}</div>
                    </td>
                    <td className="table-td text-xs">
                      <div className="truncate" title={r.giver_title}>{r.giver_title}</div>
                      <i className="fas fa-arrow-right text-gray-300 text-[9px] my-0.5 block" />
                      <div className="truncate" title={r.receiver_title}>{r.receiver_title}</div>
                    </td>
                    <td className="table-td text-xs text-gray-500 truncate" title={r.description || ''}>{r.description||'-'}</td>
                    <td className="table-td font-semibold whitespace-nowrap">{fmtCurrency(r.amount)}</td>
                    <td className="table-td whitespace-nowrap"><StatusBadge status={r.status} remarks={r.remarks} /></td>
                    <td className="table-td text-xs" dangerouslySetInnerHTML={{ __html: r.uploader_info||r.uploader||'—' }} />
                    <td className="table-td text-xs hidden md:table-cell" dangerouslySetInnerHTML={{ __html: r.ops_info||'—' }} />

                    <td className="table-td">
                      <div className="table-actions">
                        <button onClick={()=>r.file_id&&setPreviewFile(r.file_id)} className={`btn-icon ${r.file_id?'bg-cyan-50 text-cyan-600 hover:bg-cyan-100':'bg-gray-50 text-gray-300 cursor-not-allowed'}`} title={r.file_id ? 'Preview' : 'No file'}><i className="fas fa-eye" /></button>
                        {canUpload&&<><button onClick={()=>handleUpload(r)} className="btn-icon bg-blue-50 text-blue-600 hover:bg-blue-100" title="Upload"><i className="fas fa-upload" /></button><button onClick={()=>openModal(r)} className="btn-icon bg-gray-50 text-gray-500 hover:bg-gray-100" title="Edit"><i className="fas fa-pencil-alt" /></button></>}
                        {r.status==='Pending'&&canCheck&&<button onClick={()=>setOpsTarget(r)} className="btn-icon bg-blue-50 text-blue-600 hover:bg-blue-100" title="Check"><i className="fas fa-check" /></button>}
                        <button 
                          onClick={()=>handleSendEmail(r)} 
                          className={`btn-icon ${r.status === 'Checked' ? 'bg-amber-50 text-amber-500 hover:bg-amber-100' : 'bg-gray-50 text-gray-300 cursor-not-allowed'}`} 
                          title={r.status === 'Checked' ? 'Send Email' : 'Available only for Checked status'}
                          disabled={r.status !== 'Checked'}
                        >
                          <i className="fas fa-envelope" />
                        </button>
                        {isAdmin && r.status !== 'Checked' && <button onClick={()=>handleDelete(r)} className="btn-icon bg-red-50 text-red-500 hover:bg-red-100" title="Delete"><i className="fas fa-trash" /></button>}
                      </div>
                    </td>
                  </tr>
                  )
                })
              }
              {/* Total row */}
              {paged.length > 0 && (
                <tr className="bg-gray-50 dark:bg-slate-800/50 font-semibold">
                  <td className="table-td" colSpan={7}>
                    <span className="text-sm text-gray-700 dark:text-gray-200">Total ({paged.length} rows on this page)</span>
                  </td>
                  <td className="table-td font-bold text-gray-900 dark:text-gray-100 text-sm">
                    {fmtCurrency(paged.reduce((sum, r) => sum + Number(r.amount || 0), 0))}
                  </td>
                  <td className="table-td" colSpan={5}></td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <Pagination page={page} total={filtered.length} onChange={setPage} />
      </div>

      {/* Modal */}
      {showModal && (
        <div className="modal-backdrop" onClick={()=>setShowModal(false)}>
          <div className="modal-panel max-w-lg max-h-[90vh] overflow-y-auto" onClick={e=>e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title"><i className="fas fa-exchange-alt text-sky-200" />{editing?'Edit SBAR':'New SBAR / Transfer'}</h3>
              <p className="modal-subtitle">Transfer budget between branch accounts</p>
            </div>
            <div className="modal-body space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">Type</label><select className="input" value={form.type} onChange={e=>setForm(f=>({...f,type:e.target.value}))}><option>SBAR</option><option>Budget Transfer</option></select></div>
                <div><label className="label">Date</label><input type="date" className="input" value={form.date} onChange={e=>setForm(f=>({...f,date:e.target.value}))} /></div>
              </div>
              <div className="p-3 bg-blue-50 dark:bg-sky-400/10 border border-blue-100 dark:border-sky-300/20 rounded-xl">
                <label className="label text-blue-600 dark:text-sky-200 mb-2">GIVER Branch</label>
                <div className="grid grid-cols-2 gap-2">
                  <div className="relative">
                    <input
                      className="input text-sm font-semibold uppercase"
                      placeholder="Code (e.g. B0001)"
                      value={form.giverCode}
                      onFocus={() => setGiverLookupOpen(true)}
                      onBlur={() => setTimeout(() => setGiverLookupOpen(false), 200)}
                      onChange={e => {
                        const code = e.target.value.toUpperCase().replace(/O/g, '0')
                        const branch = branchOptions.find(b => b.value === code)
                        setForm(f => ({ ...f, giverCode: code, giverName: branch ? branch.label.split(' - ').slice(1).join(' - ') : '' }))
                        setGiverLookupOpen(true)
                      }}
                    />
                    {giverLookupOpen && (
                      <div className="absolute left-0 right-0 top-full z-40 mt-1 max-h-72 overflow-y-auto rounded-xl border border-blue-500 bg-white shadow-xl">
                        {(() => {
                          const needle = String(form.giverCode || '').trim().toLowerCase()
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
                                setForm(f => ({ ...f, giverCode: branch.value, giverName: branch.label.split(' - ').slice(1).join(' - ') }))
                                setGiverLookupOpen(false)
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
                  <div><input className="input text-sm text-rose-700 font-semibold" readOnly value={form.giverName} placeholder="Branch name" /></div>
                </div>
              </div>
              <div className="p-3 bg-emerald-50 dark:bg-emerald-400/10 border border-emerald-100 dark:border-emerald-300/20 rounded-xl">
                <label className="label text-emerald-600 dark:text-emerald-200 mb-2">RECEIVER Branch</label>
                <div className="grid grid-cols-2 gap-2">
                  <div className="relative">
                    <input
                      className="input text-sm font-semibold uppercase"
                      placeholder="Code (e.g. B0001)"
                      value={form.receiverCode}
                      onFocus={() => setReceiverLookupOpen(true)}
                      onBlur={() => setTimeout(() => setReceiverLookupOpen(false), 200)}
                      onChange={e => {
                        const code = e.target.value.toUpperCase().replace(/O/g, '0')
                        const branch = branchOptions.find(b => b.value === code)
                        setForm(f => ({ ...f, receiverCode: code, receiverName: branch ? branch.label.split(' - ').slice(1).join(' - ') : '' }))
                        setReceiverLookupOpen(true)
                      }}
                    />
                    {receiverLookupOpen && (
                      <div className="absolute left-0 right-0 top-full z-40 mt-1 max-h-72 overflow-y-auto rounded-xl border border-emerald-500 bg-white shadow-xl">
                        {(() => {
                          const needle = String(form.receiverCode || '').trim().toLowerCase()
                          const matches = (needle ? branchOptions.filter(branch => `${branch.value} ${branch.label}`.toLowerCase().includes(needle)) : branchOptions).slice(0, 10)
                          return matches.length === 0 ? (
                            <div className="px-4 py-3 text-sm text-slate-500">No branch found</div>
                          ) : matches.map(branch => (
                            <button
                              key={branch.value}
                              type="button"
                              className="grid w-full grid-cols-[72px_1fr] gap-2 border-b border-slate-100 px-4 py-2.5 text-left text-sm transition last:border-b-0 hover:bg-emerald-50"
                              onMouseDown={event => {
                                event.preventDefault()
                                setForm(f => ({ ...f, receiverCode: branch.value, receiverName: branch.label.split(' - ').slice(1).join(' - ') }))
                                setReceiverLookupOpen(false)
                              }}
                            >
                              <span className="font-bold text-emerald-700">{branch.value}</span>
                              <span className="text-slate-600 truncate">{branch.label.split(' - ').slice(1).join(' - ')}</span>
                            </button>
                          ))
                        })()}
                      </div>
                    )}
                  </div>
                  <div><input className="input text-sm text-rose-700 font-semibold" readOnly value={form.receiverName} placeholder="Branch name" /></div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">Account Title (Giver)</label><select className="input" value={form.giverTitle} onChange={e=>setForm(f=>({...f,giverTitle:e.target.value}))}><option value="">Select...</option>{titles.map(t=><option key={t}>{t}</option>)}</select></div>
                <div><label className="label">Account Title (Receiver)</label><select className="input" value={form.receiverTitle} onChange={e=>setForm(f=>({...f,receiverTitle:e.target.value}))}><option value="">Select...</option>{titles.map(t=><option key={t}>{t}</option>)}</select></div>
              </div>
              <div><label className="label">Description</label><textarea className="input resize-none" rows={2} value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))} /></div>
              <div><label className="label">Amount (₱)</label><input type="number" className="input" value={form.amount} onChange={e=>setForm(f=>({...f,amount:e.target.value}))} /></div>
              <div className="flex gap-2 mt-5 justify-end">
              <button onClick={()=>setShowModal(false)} className="btn-secondary">Cancel</button>
              <button onClick={handleSave} className="btn-primary">{editing?'Update':'Submit'}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {opsTarget&&<OpsModal record={opsTarget} onConfirm={(a,p)=>handleProcess(a,p,opsTarget)} onClose={()=>setOpsTarget(null)} />}
      {previewFile&&<FilePreviewModal fileId={previewFile} onClose={()=>setPreviewFile(null)} />}
    </div>
  )
}
