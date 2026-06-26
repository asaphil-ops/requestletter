import { useMemo, useState } from 'react'
import {
  useComplianceCertificates,
  useCreateComplianceCertificate,
  useDeleteComplianceCertificate,
  useUpdateComplianceCertificate,
  useUpdateComplianceFile,
} from '../hooks/useCompliance'
import { useAuthStore } from '../store/authStore'
import { branchCodesMatch, getBranchCodeAliases, useBranches, useBranchOptions } from '../hooks/useBranches'
import { deleteFromDrive, uploadToDrive } from '../lib/gas'
import { downloadCSV } from '../lib/csv'
import { ROWS_PER_PAGE, normalizeText } from '../lib/utils'
import Pagination from '../components/shared/Pagination'
import { EmptyRow, TableLoader } from '../components/shared/Loader'
import SegmentedSearchSelect from '../components/shared/SegmentedSearchSelect'
import FilePreviewModal from '../components/shared/FilePreviewModal'
import TimelineModal from '../components/shared/TimelineModal'
import { WORKFLOW_MODULES } from '../lib/workflow'
import Swal from 'sweetalert2'

const EMPTY_FORM = {
  branch_code: '',
  branch_name: '',
  branch_type: '',
  tin: '',
  cor_address: '',
  dole_address: '',
  cams_address: '',
  cor_link: '',
  dole_link: '',
}

const csvHeaders = [
  'Branch Code',
  'Branch Name',
  'TIN',
  'COR Address',
  'COR Link',
  'DOLE Link',
  'DOLE Address',
  'CAMS Address',
]

const compact = (value) => normalizeText(value)

const safeFilePart = (value) =>
  compact(value)
    .replace(/[\\/:*?"<>|]+/g, '')
    .replace(/\s+/g, ' ')

const renameCertificateFile = (file, record, form, label) => {
  const branchCode = safeFilePart(record?.branch_code || form.branch_code)
  const branchName = safeFilePart(record?.branch_name || form.branch_name)
  const extension = file.name.includes('.') ? `.${file.name.split('.').pop()}` : ''
  const fileName = [branchCode, branchName].filter(Boolean).join(' ')
  return new File([file], `${fileName} - ${label}${extension}`, { type: file.type })
}

const getDriveFileIdFromLink = (link) => {
  const value = compact(link)
  if (!value) return ''
  const filePathMatch = value.match(/\/file\/d\/([^/]+)/)
  if (filePathMatch?.[1]) return filePathMatch[1]
  const idMatch = value.match(/[?&]id=([^&]+)/)
  if (idMatch?.[1]) return idMatch[1]
  return value
}

export default function ComplianceCertificates() {
  const { canUpload, isAdmin, isSuperAdmin } = useAuthStore()
  const { data = [], isLoading } = useComplianceCertificates()
  const createRecord = useCreateComplianceCertificate()
  const updateRecord = useUpdateComplianceCertificate()
  const deleteRecord = useDeleteComplianceCertificate()
  const updateFile = useUpdateComplianceFile()
  const { data: branches = [] } = useBranches()
  const branchOptions = useBranchOptions()

  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [branchLookupOpen, setBranchLookupOpen] = useState(false)
  const [geoFilter, setGeoFilter] = useState({ operation: '', division: '', region: '', area: '', branchCode: '' })
  const [uploadingField, setUploadingField] = useState('')
  const [pendingDriveFiles, setPendingDriveFiles] = useState({})
  const [certFilter, setCertFilter] = useState('')
  const [previewFile, setPreviewFile] = useState('')
  const [timelineTarget, setTimelineTarget] = useState(null)

  const geoLists = useMemo(() => {
    const operations = [...new Set(branches.map(branch => branch.operation).filter(Boolean))].sort()

    let divBranches = branches
    if (geoFilter.operation) {
      divBranches = divBranches.filter(branch => branch.operation === geoFilter.operation)
    }
    const divisions = [...new Set(divBranches.map(branch => branch.division).filter(Boolean))].sort()

    let regBranches = divBranches
    if (geoFilter.division) {
      regBranches = regBranches.filter(branch => branch.division === geoFilter.division)
    }
    const regions = [...new Set(regBranches.map(branch => branch.region).filter(Boolean))].sort()

    let areaBranches = regBranches
    if (geoFilter.region) {
      areaBranches = areaBranches.filter(branch => branch.region === geoFilter.region)
    }
    const areas = [...new Set(areaBranches.map(branch => branch.area).filter(Boolean))].sort()

    let branchList = areaBranches
    if (geoFilter.area) {
      branchList = branchList.filter(branch => branch.area === geoFilter.area)
    }
    const branchesOptions = branchList
      .filter(branch => branch.code && branch.name)
      .map(branch => ({ value: branch.code, label: `${branch.code} - ${branch.name}` }))
      .sort((a, b) => a.label.localeCompare(b.label))

    return { operations, divisions, regions, areas, branchesOptions }
  }, [branches, geoFilter.operation, geoFilter.division, geoFilter.region, geoFilter.area])

  const filtered = useMemo(() => {
    const needle = search.toLowerCase()
    return data
      .filter(row => !needle || [
        row.branch_code,
        row.branch_name,
        row.tin,
        row.cor_address,
        row.dole_address,
        row.cams_address,
      ].some(value => String(value || '').toLowerCase().includes(needle)))
      .filter(row => {
        if (!geoFilter.operation && !geoFilter.division && !geoFilter.region && !geoFilter.area && !geoFilter.branchCode) return true
        const branchCode = String(row.branch_code || '').trim().toUpperCase()
        const branch = branches.find(item => {
          const code = String(item.code || item.branch_code || '').trim().toUpperCase()
          return branchCodesMatch(code, branchCode)
        })
        if (!branch) return false
        if (geoFilter.operation && branch.operation !== geoFilter.operation) return false
        if (geoFilter.division && branch.division !== geoFilter.division) return false
        if (geoFilter.region && branch.region !== geoFilter.region) return false
        if (geoFilter.area && branch.area !== geoFilter.area) return false
        if (geoFilter.branchCode && !branchCodesMatch(branchCode, geoFilter.branchCode)) return false
        return true
      })
      .filter(row => {
        if (!certFilter) return true
        if (certFilter === 'with_cor') return Boolean(row.cor_link)
        if (certFilter === 'no_cor') return !row.cor_link
        if (certFilter === 'with_dole') return Boolean(row.dole_link)
        if (certFilter === 'no_dole') return !row.dole_link
        return true
      })
      .sort((a, b) => String(a.branch_code || '').localeCompare(String(b.branch_code || '')))
  }, [branches, data, geoFilter, search, certFilter])

  const paged = filtered.slice((page - 1) * ROWS_PER_PAGE, page * ROWS_PER_PAGE)

  const branchMatches = useMemo(() => {
    const needle = compact(form.branch_code).toLowerCase()
    const list = needle
      ? branchOptions.filter(branch => `${branch.value} ${branch.label}`.toLowerCase().includes(needle))
      : branchOptions
    return list.slice(0, 10)
  }, [branchOptions, form.branch_code])

  const selectedBranch = useMemo(() => {
    const code = compact(form.branch_code).toUpperCase()
    if (!code) return null
    return branches.find(branch => String(branch.code || branch.branch_code || '').trim().toUpperCase() === code) || null
  }, [branches, form.branch_code])

  const setField = (key, value) => setForm(prev => ({ ...prev, [key]: value }))

  const selectBranch = (branch) => {
    setForm(prev => ({
      ...prev,
      branch_code: branch.value,
      branch_name: branch.label.split(' - ').slice(1).join(' - '),
    }))
    setBranchLookupOpen(false)
  }

  const setGeo = (key, value) => {
    setGeoFilter(prev => {
      let next = { ...prev, [key]: value }

      if (key === 'operation') next = { ...next, division: '', region: '', area: '', branchCode: '' }
      else if (key === 'division') next = { ...next, region: '', area: '', branchCode: '' }
      else if (key === 'region') next = { ...next, area: '', branchCode: '' }
      else if (key === 'area') next = { ...next, branchCode: '' }

      if (key === 'branchCode' && value) {
        const aliases = getBranchCodeAliases(value)
        const branch = branches.find(item => {
          const code = String(item.code || item.branch_code || '').trim().toUpperCase()
          return aliases.includes(code)
        })
        if (branch) {
          next = {
            ...next,
            operation: String(branch.operation || '').trim(),
            division: String(branch.division || '').trim(),
            region: String(branch.region || '').trim(),
            area: String(branch.area || '').trim(),
          }
        }
      }

      return next
    })
    setPage(1)
  }

  const selectOptions = (items) => items.map(item => ({ value: item, label: item }))

  const openModal = (record = null) => {
    setEditing(record)
    setPendingDriveFiles({})
    setUploadingField('')
    setForm(record ? {
      branch_code: record.branch_code || '',
      branch_name: record.branch_name || '',
      branch_type: record.branch_type || '',
      tin: record.tin || '',
      cor_address: record.cor_address || '',
      dole_address: record.dole_address || '',
      cams_address: record.cams_address || '',
      cor_link: record.cor_link || '',
      dole_link: record.dole_link || '',
    } : EMPTY_FORM)
    setShowModal(true)
  }

  const cleanupPendingDriveFiles = async () => {
    const files = Object.values(pendingDriveFiles).filter(Boolean)
    if (!files.length) return
    await Promise.allSettled(files.map(file => deleteFromDrive(file.fileId)))
    setPendingDriveFiles({})
  }

  const closeModal = async () => {
    if (!editing) await cleanupPendingDriveFiles()
    setShowModal(false)
    setUploadingField('')
  }

  const handleSave = async () => {
    if (!compact(form.branch_code)) return Swal.fire('Missing field', 'Branch code is required.', 'warning')
    if (!compact(form.branch_name)) return Swal.fire('Missing field', 'Branch name is required.', 'warning')

    try {
      if (editing) {
        await updateRecord.mutateAsync({ id: editing.id, updates: form })
        Swal.fire('Updated!', '', 'success')
      } else {
        await createRecord.mutateAsync(form)
        Swal.fire('Saved!', '', 'success')
      }
      setPendingDriveFiles({})
      setShowModal(false)
    } catch (err) {
      Swal.fire('Error', err.message, 'error')
    }
  }

  const handleDelete = async (record) => {
    const result = await Swal.fire({
      title: 'Delete compliance record?',
      text: `${record.branch_code} - ${record.branch_name}`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      confirmButtonText: 'Yes, delete',
    })
    if (!result.isConfirmed) return

    try {
      await deleteRecord.mutateAsync(record)
      Swal.fire('Deleted!', '', 'success')
    } catch (err) {
      Swal.fire('Error', err.message, 'error')
    }
  }

  const handleUpload = async (record, field, label) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.pdf,.doc,.docx,.png,.jpg,.jpeg'
    input.onchange = async (event) => {
      const file = event.target.files?.[0]
      if (!file) return

      try {
        setUploadingField(field)
        Swal.fire({ title: `Uploading ${label}...`, allowOutsideClick: false, didOpen: () => Swal.showLoading() })
        const renamedFile = renameCertificateFile(file, record, form, label)
        const result = await uploadToDrive(renamedFile, { convertToPdf: true })
        const link = result.url || `https://drive.google.com/file/d/${result.fileId}/view?usp=sharing`
        setField(field, link)
        if (record?.id) {
          await updateFile.mutateAsync({ id: record.id, field, link })
        } else if (result.fileId) {
          const previous = pendingDriveFiles[field]
          if (previous?.fileId) await deleteFromDrive(previous.fileId).catch(() => {})
          setPendingDriveFiles(prev => ({ ...prev, [field]: { fileId: result.fileId, link } }))
        }
        Swal.fire('Uploaded!', `${label} saved to Google Drive.`, 'success')
      } catch (err) {
        Swal.fire('Error', err.message, 'error')
      } finally {
        setUploadingField('')
      }
    }
    input.click()
  }

  const exportCSV = () => {
    const rows = filtered.map(row => [
      row.branch_code,
      row.branch_name,
      row.tin,
      row.cor_address,
      row.cor_link,
      row.dole_link,
      row.dole_address,
      row.cams_address,
    ])
    downloadCSV([csvHeaders, ...rows], `compliance_certificates_${new Date().toISOString().split('T')[0]}.csv`)
  }

  const previewLink = (link) => {
    const fileId = getDriveFileIdFromLink(link)
    if (fileId) setPreviewFile(fileId)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Compliance</p>
          <h1 className="text-2xl font-extrabold text-gray-900 dark:text-gray-100">COR and DOLE Certificate</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={exportCSV} className="btn-secondary text-xs px-3 py-2">
            <i className="fas fa-file-excel mr-1 text-green-600" />Export
          </button>
          {canUpload && (
            <button onClick={() => openModal()} className="btn-primary text-xs px-3 py-2">
              <i className="fas fa-plus mr-1" />New Record
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl bg-gradient-to-br from-sky-600 to-blue-700 p-4 text-white shadow-sm">
          <div className="text-xs font-bold uppercase tracking-wide text-white/75">Total Records</div>
          <div className="mt-2 text-3xl font-bold">{filtered.length}</div>
        </div>
        <div className="rounded-xl bg-gradient-to-br from-emerald-600 to-teal-700 p-4 text-white shadow-sm">
          <div className="text-xs font-bold uppercase tracking-wide text-white/75">With COR</div>
          <div className="mt-2 text-3xl font-bold">{filtered.filter(row => row.cor_link).length}</div>
        </div>
        <div className="rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 p-4 text-white shadow-sm">
          <div className="text-xs font-bold uppercase tracking-wide text-white/75">With DOLE</div>
          <div className="mt-2 text-3xl font-bold">{filtered.filter(row => row.dole_link).length}</div>
        </div>
      </div>

      <div className="card p-4">
        <div className="flex flex-wrap gap-2">
          <div className="relative min-w-[220px] flex-1">
            <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400" />
            <input
              className="input pl-9"
              value={search}
              placeholder="Search branch, TIN, or address..."
              onChange={event => { setSearch(event.target.value); setPage(1) }}
            />
          </div>
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
          <button
            onClick={() => {
              setSearch('')
              setGeoFilter({ operation: '', division: '', region: '', area: '', branchCode: '' })
              setCertFilter('')
              setPage(1)
            }}
            className="btn-secondary text-xs px-3 py-1.5"
          >
            <i className="fas fa-sync-alt mr-1" />Reset
          </button>
          <div className="flex gap-1.5">
            <button
              onClick={() => { setCertFilter(certFilter === 'with_cor' ? '' : 'with_cor'); setPage(1) }}
              className={`text-xs px-3 py-1.5 rounded-lg font-semibold transition-all ${certFilter === 'with_cor' ? 'bg-emerald-100 text-emerald-700 border border-emerald-300' : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'}`}
            >
              With COR
            </button>
            <button
              onClick={() => { setCertFilter(certFilter === 'no_cor' ? '' : 'no_cor'); setPage(1) }}
              className={`text-xs px-3 py-1.5 rounded-lg font-semibold transition-all ${certFilter === 'no_cor' ? 'bg-red-100 text-red-700 border border-red-300' : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'}`}
            >
              No COR
            </button>
            <button
              onClick={() => { setCertFilter(certFilter === 'with_dole' ? '' : 'with_dole'); setPage(1) }}
              className={`text-xs px-3 py-1.5 rounded-lg font-semibold transition-all ${certFilter === 'with_dole' ? 'bg-blue-100 text-blue-700 border border-blue-300' : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'}`}
            >
              With DOLE
            </button>
            <button
              onClick={() => { setCertFilter(certFilter === 'no_dole' ? '' : 'no_dole'); setPage(1) }}
              className={`text-xs px-3 py-1.5 rounded-lg font-semibold transition-all ${certFilter === 'no_dole' ? 'bg-amber-100 text-amber-700 border border-amber-300' : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'}`}
            >
              No DOLE
            </button>
          </div>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto overflow-y-auto max-h-[70vh]">
          <table className="w-full min-w-[1480px] table-fixed">
            <colgroup>
              <col className="w-12" />
              <col className="w-32" />
              <col className="w-44" />
              <col className="w-28" />
              <col className="w-36" />
              <col className="w-36" />
              <col className="w-36" />
              <col className="w-36" />
              <col className="w-[4.5rem]" />
              <col className="w-[4.5rem]" />
              <col className="w-44" />
            </colgroup>
            <thead className="sticky top-0 z-20 bg-white shadow-sm dark:bg-slate-900">
              <tr>
                <th className="table-th w-12">&#35;</th>
                <th className="table-th w-32">Branch Code</th>
                <th className="table-th w-44">Branch Name</th>
                <th className="table-th w-28">Type</th>
                <th className="table-th w-36">TIN</th>
                <th className="table-th w-36">COR Addr</th>
                <th className="table-th w-36">DOLE Addr</th>
                <th className="table-th w-36">CAMS Addr</th>
                <th className="table-th w-[4.5rem]">COR</th>
                <th className="table-th w-[4.5rem]">DOLE</th>
                <th className="table-th w-44 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? <TableLoader /> : paged.length === 0 ? <EmptyRow cols={11} /> : paged.map((row, index) => (
                <tr key={row.id} className="table-tr">
                  <td className="table-td text-xs text-gray-400">{(page - 1) * ROWS_PER_PAGE + index + 1}</td>
                  <td className="table-td font-semibold">{row.branch_code}</td>
                  <td className="table-td w-44 truncate" title={row.branch_name}>{compact(row.branch_name)}</td>
                  <td className="table-td w-28 truncate" title={row.branch_type || '-'}>{compact(row.branch_type) || '-'}</td>
                  <td className="table-td w-36 truncate" title={row.tin || ''}>{row.tin || '-'}</td>
                  <td className="table-td w-36 truncate" title={row.cor_address || ''}>{compact(row.cor_address || '-')}</td>
                  <td className="table-td w-36 truncate" title={row.dole_address || ''}>{compact(row.dole_address || '-')}</td>
                  <td className="table-td w-36 truncate" title={row.cams_address || ''}>{compact(row.cams_address || '-')}</td>
                  <td className="table-td">
                    {row.cor_link ? <button type="button" className="text-xs font-bold text-sky-600 hover:underline" onClick={() => previewLink(row.cor_link)}>Preview COR</button> : <span className="text-xs text-gray-400">No file</span>}
                  </td>
                  <td className="table-td">
                    {row.dole_link ? <button type="button" className="text-xs font-bold text-sky-600 hover:underline" onClick={() => previewLink(row.dole_link)}>Preview DOLE</button> : <span className="text-xs text-gray-400">No file</span>}
                  </td>
                  <td className="table-td">
                    <div className="table-actions justify-end">
                      {canUpload && (
                        <>
                          <button onClick={() => handleUpload(row, 'cor_link', 'COR')} className="btn-icon bg-emerald-50 text-emerald-600 hover:bg-emerald-100" title="Upload COR"><i className="fas fa-file-upload" /></button>
                          <button onClick={() => handleUpload(row, 'dole_link', 'DOLE')} className="btn-icon bg-blue-50 text-blue-600 hover:bg-blue-100" title="Upload DOLE"><i className="fas fa-cloud-upload-alt" /></button>
                          <button onClick={() => openModal(row)} className="btn-icon bg-gray-50 text-gray-500 hover:bg-gray-100" title="Edit"><i className="fas fa-pencil-alt" /></button>
                        </>
                      )}
                      <button onClick={() => setTimelineTarget(row)} className="btn-icon bg-slate-50 text-slate-500 hover:bg-slate-100" title="History"><i className="fas fa-clock-rotate-left" /></button>
                      {(isAdmin || isSuperAdmin) && <button onClick={() => handleDelete(row)} className="btn-icon bg-red-50 text-red-500 hover:bg-red-100" title="Delete"><i className="fas fa-trash" /></button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination page={page} total={filtered.length} onChange={setPage} />
      </div>

      {showModal && (
        <div className="modal-backdrop" onClick={closeModal}>
          <div className="modal-panel max-w-2xl max-h-[90vh] flex flex-col overflow-hidden" onClick={event => event.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title"><i className="fas fa-certificate text-sky-200" />{editing ? 'Edit Compliance Record' : 'New Compliance Record'}</h3>
              <p className="modal-subtitle">Branch COR, DOLE, and CAMS compliance details</p>
            </div>
            <div className="modal-body flex-1 space-y-3 overflow-y-auto">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="relative">
                  <label className="label">Branch Code *</label>
                  <input
                    className="input font-semibold uppercase"
                    value={form.branch_code}
                    placeholder="B0001"
                    onFocus={() => setBranchLookupOpen(true)}
                    onBlur={() => setTimeout(() => setBranchLookupOpen(false), 200)}
                    onChange={event => {
                      const code = event.target.value.toUpperCase().replace(/O/g, '0')
                      const branch = branchOptions.find(option => option.value === code)
                      setForm(prev => ({
                        ...prev,
                        branch_code: code,
                        branch_name: branch ? branch.label.split(' - ').slice(1).join(' - ') : prev.branch_name,
                      }))
                      setBranchLookupOpen(true)
                    }}
                  />
                  {branchLookupOpen && (
                    <div className="absolute left-0 right-0 top-full z-40 mt-1 max-h-72 overflow-y-auto rounded-xl border border-blue-500 bg-white shadow-xl">
                      {branchMatches.length === 0 ? (
                        <div className="px-4 py-3 text-sm text-slate-500">No branch found</div>
                      ) : branchMatches.map(branch => (
                        <button
                          key={branch.value}
                          type="button"
                          className="grid w-full grid-cols-[72px_1fr] gap-2 border-b border-slate-100 px-4 py-2.5 text-left text-sm transition last:border-b-0 hover:bg-blue-50"
                          onMouseDown={event => {
                            event.preventDefault()
                            selectBranch(branch)
                          }}
                        >
                          <span className="font-bold text-blue-700">{branch.value}</span>
                          <span className="truncate text-slate-600">{branch.label.split(' - ').slice(1).join(' - ')}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <label className="label">Branch Name *</label>
                  <input className="input font-semibold text-rose-700" readOnly value={selectedBranch?.name || form.branch_name} placeholder="Auto-filled" />
                </div>
                <div>
                  <label className="label">Branch Type</label>
                  <select
                    className="input"
                    value={form.branch_type}
                    onChange={event => setField('branch_type', event.target.value)}
                  >
                    <option value="">Select type...</option>
                    <option value="Single">Single</option>
                    <option value="Mother">Mother</option>
                    <option value="Satellite I">Satellite I</option>
                    <option value="Satellite II">Satellite II</option>
                  </select>
                </div>
                <div>
                  <label className="label">Area</label>
                  <input className="input text-sm" readOnly value={selectedBranch?.area || ''} placeholder="Auto-filled" />
                </div>
                <div>
                  <label className="label">Region</label>
                  <input className="input text-sm" readOnly value={selectedBranch?.region || ''} placeholder="Auto-filled" />
                </div>
                <div>
                  <label className="label">Division</label>
                  <input className="input text-sm" readOnly value={selectedBranch?.division || ''} placeholder="Auto-filled" />
                </div>
                <div>
                  <label className="label">Operation</label>
                  <input className="input text-sm" readOnly value={selectedBranch?.operation || ''} placeholder="Auto-filled" />
                </div>
                <div>
                  <label className="label">TIN</label>
                  <input className="input" value={form.tin} onChange={event => setField('tin', event.target.value)} />
                </div>
                <div className="sm:col-span-2">
                  <label className="label">COR Address</label>
                  <textarea className="input resize-none" rows={2} value={form.cor_address} onChange={event => setField('cor_address', event.target.value)} />
                </div>
                <div className="sm:col-span-2">
                  <label className="label">DOLE Address</label>
                  <textarea className="input resize-none" rows={2} value={form.dole_address} onChange={event => setField('dole_address', event.target.value)} />
                </div>
                <div className="sm:col-span-2">
                  <label className="label">CAMS Address</label>
                  <input className="input" value={form.cams_address} onChange={event => setField('cams_address', event.target.value)} />
                </div>
                <div className="sm:col-span-2 rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="mb-3 text-sm font-bold text-slate-800">Certificate Uploads</div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-lg border border-slate-200 bg-white p-3">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <div className="text-xs font-bold uppercase text-slate-500">COR Certificate</div>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase ${uploadingField === 'cor_link' ? 'bg-amber-100 text-amber-700' : form.cor_link ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                          {uploadingField === 'cor_link' ? 'Uploading' : form.cor_link ? 'Attached' : 'No file'}
                        </span>
                      </div>
                      <button
                        type="button"
                        disabled={Boolean(uploadingField) || updateFile.isPending}
                        onClick={() => handleUpload(editing, 'cor_link', 'COR')}
                        className="btn-secondary inline-flex w-full items-center justify-center gap-2 text-xs px-3 py-2 disabled:cursor-not-allowed disabled:opacity-50"
                        title="Upload COR certificate"
                      >
                        <i className={`fas ${uploadingField === 'cor_link' ? 'fa-spinner animate-spin text-amber-600' : 'fa-file-upload text-emerald-600'}`} />{uploadingField === 'cor_link' ? 'Uploading COR...' : form.cor_link ? 'Replace COR' : 'Upload COR'}
                      </button>
                      {form.cor_link && <button type="button" className="mt-2 block max-w-full truncate text-left text-xs font-semibold text-sky-600 hover:underline" onClick={() => previewLink(form.cor_link)}>Preview attached COR</button>}
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-white p-3">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <div className="text-xs font-bold uppercase text-slate-500">DOLE Certificate</div>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase ${uploadingField === 'dole_link' ? 'bg-amber-100 text-amber-700' : form.dole_link ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                          {uploadingField === 'dole_link' ? 'Uploading' : form.dole_link ? 'Attached' : 'No file'}
                        </span>
                      </div>
                      <button
                        type="button"
                        disabled={Boolean(uploadingField) || updateFile.isPending}
                        onClick={() => handleUpload(editing, 'dole_link', 'DOLE')}
                        className="btn-secondary inline-flex w-full items-center justify-center gap-2 text-xs px-3 py-2 disabled:cursor-not-allowed disabled:opacity-50"
                        title="Upload DOLE certificate"
                      >
                        <i className={`fas ${uploadingField === 'dole_link' ? 'fa-spinner animate-spin text-amber-600' : 'fa-cloud-upload-alt text-blue-600'}`} />{uploadingField === 'dole_link' ? 'Uploading DOLE...' : form.dole_link ? 'Replace DOLE' : 'Upload DOLE'}
                      </button>
                      {form.dole_link && <button type="button" className="mt-2 block max-w-full truncate text-left text-xs font-semibold text-sky-600 hover:underline" onClick={() => previewLink(form.dole_link)}>Preview attached DOLE</button>}
                    </div>
                  </div>
                  {!editing && (
                    <p className="mt-2 text-xs font-semibold text-slate-500">Uploaded links will be saved with this new record.</p>
                  )}
                </div>
                <div>
                  <label className="label">COR Link</label>
                  <input className="input" value={form.cor_link} onChange={event => setField('cor_link', event.target.value)} />
                </div>
                <div>
                  <label className="label">DOLE Link</label>
                  <input className="input" value={form.dole_link} onChange={event => setField('dole_link', event.target.value)} />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-200 bg-white px-6 py-4">
              <button onClick={closeModal} className="btn-secondary">Cancel</button>
              <button onClick={handleSave} disabled={createRecord.isPending || updateRecord.isPending} className="btn-primary">
                {editing ? 'Update' : 'Save Record'}
              </button>
            </div>
          </div>
        </div>
      )}
      {previewFile && <FilePreviewModal fileId={previewFile} showOpenButton={false} onClose={() => setPreviewFile('')} />}
      {timelineTarget && <TimelineModal record={timelineTarget} module={WORKFLOW_MODULES.compliance} onClose={() => setTimelineTarget(null)} />}
    </div>
  )
}
