import { useState, useMemo } from 'react'
import { useStaff, useAddStaff, useDeleteStaff, useStaffFilters } from '../hooks/useStaff'
import { useBranchOptions } from '../hooks/useBranches'
import { useAuthStore } from '../store/authStore'
import { fmtNum, ROWS_PER_PAGE, toTitleCase } from '../lib/utils'
import Pagination from '../components/shared/Pagination'
import { TableLoader, EmptyRow } from '../components/shared/Loader'
import SegmentedSearchSelect from '../components/shared/SegmentedSearchSelect'
import Swal from 'sweetalert2'

export default function Directory() {
  const { isAdmin } = useAuthStore()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [geoFilter, setGeoFilter] = useState({ operation: '', division: '', region: '', area: '', branchCode: '' })
  const [showModal, setShowModal] = useState(false)
  const [sortKey, setSortKey] = useState('last_name')
  const [sortDir, setSortDir] = useState('asc')

  const { data: staff = [], isLoading } = useStaff()
  const staffFilters = useStaffFilters()
  const branchOptions = useBranchOptions()
  const addStaff = useAddStaff()
  const deleteStaff = useDeleteStaff()

  const EMPTY_FORM = { id: '', first_name: '', last_name: '', position: '', email: '', branch_code: '', branch_name: '', area: '', region: '', division: '', operation: '' }
  const [form, setForm] = useState(EMPTY_FORM)

  const setGeo = (key, val) => setGeoFilter(p => {
    const n = { ...p, [key]: val }
    if (key === 'operation') { n.division = ''; n.region = ''; n.area = ''; n.branchCode = '' }
    if (key === 'division')  { n.region = ''; n.area = ''; n.branchCode = '' }
    if (key === 'region')    { n.area = ''; n.branchCode = '' }
    return n
  })

  const handleBranchSelect = (code) => {
    const branch = branchOptions.find(b => b.value === code)
    if (branch) {
      setForm(f => ({
        ...f, branch_code: code,
        branch_name: branch.label.split(' - ').slice(1).join(' - '),
        area: branch.area || '', region: branch.region || '',
        division: branch.division || '', operation: branch.operation || ''
      }))
    } else {
      setForm(f => ({ ...f, branch_code: code, branch_name: '', area: '', region: '', division: '', operation: '' }))
    }
  }

  const filtered = useMemo(() => {
    let arr = [...staff]
    if (search) arr = arr.filter(s => (s.name + s.id).toLowerCase().includes(search.toLowerCase()))
    if (geoFilter.operation) arr = arr.filter(s => s.operation === geoFilter.operation)
    if (geoFilter.division)  arr = arr.filter(s => s.division  === geoFilter.division)
    if (geoFilter.region)    arr = arr.filter(s => s.region    === geoFilter.region)
    if (geoFilter.area)      arr = arr.filter(s => s.area      === geoFilter.area)
    if (geoFilter.branchCode) arr = arr.filter(s => s.branch_code === geoFilter.branchCode)
    arr.sort((a, b) => {
      const av = a[sortKey] ?? ''; const bv = b[sortKey] ?? ''
      const cmp = String(av).localeCompare(String(bv))
      return sortDir === 'asc' ? cmp : -cmp
    })
    return arr
  }, [staff, search, geoFilter, sortKey, sortDir])

  const paged = filtered.slice((page - 1) * ROWS_PER_PAGE, page * ROWS_PER_PAGE)

  const handleSave = async () => {
    if (!form.id || !form.last_name) return Swal.fire('Error', 'ID and Last Name are required', 'error')
    try {
      await addStaff.mutateAsync({
        id: form.id.trim().toUpperCase(),
        first_name: form.first_name, last_name: form.last_name,
        position: form.position, email: form.email,
        branch_code: form.branch_code, branch_name: form.branch_name,
        area: form.area, region: form.region, division: form.division, operation: form.operation
      })
      setShowModal(false)
      setForm(EMPTY_FORM)
      Swal.fire('Saved!', 'Staff record added.', 'success')
    } catch (err) { Swal.fire('Error', err.message, 'error') }
  }

  const handleDelete = (s) => {
    Swal.fire({ title: `Delete ${s.name}?`, text: 'This cannot be undone.', icon: 'warning', showCancelButton: true, confirmButtonColor: '#ef4444', confirmButtonText: 'Yes, delete' })
      .then(r => { if (r.isConfirmed) deleteStaff.mutateAsync(s.id).then(() => Swal.fire('Deleted!', '', 'success')).catch(e => Swal.fire('Error', e.message, 'error')) })
  }

  const handleSort = (key) => { if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc'); else { setSortKey(key); setSortDir('asc') }; setPage(1) }
  const SortIcon = ({ k }) => sortKey === k ? <i className={`fas fa-sort-${sortDir === 'asc' ? 'up' : 'down'} text-blue-500 text-xs ml-1`} /> : <i className="fas fa-sort text-gray-300 text-xs ml-1" />
  const selectOptions = (items) => items.map(item => ({ value: item, label: item }))

  // Cascading selects
  const unique = (key) => {
    let arr = staff
    if (key !== 'operation' && geoFilter.operation) arr = arr.filter(s => s.operation === geoFilter.operation)
    if (!['operation','division'].includes(key) && geoFilter.division) arr = arr.filter(s => s.division === geoFilter.division)
    if (!['operation','division','region'].includes(key) && geoFilter.region) arr = arr.filter(s => s.region === geoFilter.region)
    return [...new Set(arr.map(s => s[key]).filter(Boolean))].sort()
  }
  const filteredBranches = useMemo(() => {
    if (!geoFilter.operation) return branchOptions
    const codes = new Set(staff.filter(s => s.operation === geoFilter.operation).map(s => s.branch_code).filter(Boolean))
    return branchOptions.filter(b => codes.has(b.value))
  }, [staff, branchOptions, geoFilter.operation])

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900 dark:text-gray-100">Employee Directory</h1>
          <p className="text-sm font-semibold text-gray-500">Staff records and branch assignments · {fmtNum(filtered.length)} records</p>
        </div>
        {isAdmin && (
          <button onClick={() => { setForm(EMPTY_FORM); setShowModal(true) }} className="btn-primary text-xs px-3 py-2">
            <i className="fas fa-plus mr-1" />Add Staff
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="card p-4 mb-4">
        <div className="flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-[180px]">
            <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
            <input className="input pl-9 text-sm" placeholder="Search Name or ID..." value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} />
          </div>
          <SegmentedSearchSelect label="Operation" value={geoFilter.operation} options={selectOptions(staffFilters.operations)} onChange={value => { setGeo('operation', value); setPage(1) }} />
          <SegmentedSearchSelect label="Division" value={geoFilter.division} options={selectOptions(unique('division'))} onChange={value => { setGeo('division', value); setPage(1) }} />
          <SegmentedSearchSelect label="Region" value={geoFilter.region} options={selectOptions(unique('region'))} onChange={value => { setGeo('region', value); setPage(1) }} />
          <SegmentedSearchSelect label="Area" value={geoFilter.area} options={selectOptions(unique('area'))} onChange={value => { setGeo('area', value); setPage(1) }} />
          <SegmentedSearchSelect label="Branch" value={geoFilter.branchCode} options={filteredBranches} onChange={value => { setGeo('branchCode', value); setPage(1) }} className="w-[260px]" />
          <button onClick={() => { setSearch(''); setGeoFilter({ operation: '', division: '', region: '', area: '', branchCode: '' }); setPage(1) }} className="btn-secondary text-xs px-3 py-1.5">
            <i className="fas fa-sync-alt mr-1" />Reset
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto overflow-y-auto max-h-[70vh]">
          <table className="w-full min-w-[800px]">
            <thead className="sticky top-0 z-20 bg-white dark:bg-slate-900 shadow-sm">
              <tr>
                <th className="table-th">#</th>
                {[['id','ID'],['last_name','Name'],['position','Position'],['branch_code','Branch'],['area','Area'],['region','Region'],['division','Division'],['operation','Operation']].map(([k,l]) => (
                  <th key={k} className="table-th cursor-pointer" onClick={() => handleSort(k)}>{l}<SortIcon k={k} /></th>
                ))}
                {isAdmin && <th className="table-th text-right w-20">Action</th>}
              </tr>
            </thead>
            <tbody>
              {isLoading ? <TableLoader /> : paged.length === 0 ? <EmptyRow cols={isAdmin ? 10 : 9} /> :
                paged.map((s, idx) => (
                  <tr key={s.id} className="table-tr">
                    <td className="table-td text-gray-400 text-xs">{(page - 1) * ROWS_PER_PAGE + idx + 1}</td>
                    <td className="table-td"><span className="font-bold text-blue-600 text-xs">{s.id}</span></td>
                    <td className="table-td font-semibold">{s.name}</td>
                    <td className="table-td text-gray-500 text-sm">{s.position}</td>
                    <td className="table-td text-sm">{s.branch}</td>
                    <td className="table-td text-sm text-gray-500">{s.area}</td>
                    <td className="table-td text-sm text-gray-500">{s.region}</td>
                    <td className="table-td text-sm text-gray-500">{s.division}</td>
                    <td className="table-td text-sm text-gray-500">{s.operation}</td>
                    {isAdmin && (
                      <td className="table-td">
                        <div className="table-actions">
                          <button onClick={() => handleDelete(s)} className="btn-icon bg-red-50 text-red-500 hover:bg-red-100" title="Delete">
                            <i className="fas fa-trash text-xs" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              }
            </tbody>
          </table>
        </div>
        <Pagination page={page} total={filtered.length} onChange={setPage} />
      </div>

      {/* Add Staff Modal */}
      {showModal && (
        <div className="modal-backdrop" onClick={() => setShowModal(false)}>
          <div className="modal-panel max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title"><i className="fas fa-user-plus text-sky-200" />New Staff Entry</h3>
              <p className="modal-subtitle">Create employee profile and branch assignment</p>
            </div>

            <div className="modal-body">
            <div className="mb-4">
              <h4 className="text-xs font-bold text-blue-600 dark:text-sky-200 uppercase tracking-wide mb-3">Personal Information</h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div><label className="label">ID Number *</label><input className="input" value={form.id} onChange={e => setForm(f => ({ ...f, id: e.target.value }))} placeholder="EMP001" /></div>
                <div><label className="label">First Name</label><input className="input" value={form.first_name} onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))} /></div>
                <div><label className="label">Last Name *</label><input className="input" value={form.last_name} onChange={e => setForm(f => ({ ...f, last_name: e.target.value }))} /></div>
                <div><label className="label">Position</label><input className="input" value={form.position} onChange={e => setForm(f => ({ ...f, position: e.target.value }))} /></div>
                <div className="sm:col-span-2"><label className="label">Email</label><input type="email" className="input" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></div>
              </div>
            </div>

            <div>
              <h4 className="text-xs font-bold text-blue-600 dark:text-sky-200 uppercase tracking-wide mb-3">Branch Assignment</h4>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div>
                  <label className="label text-blue-600 dark:text-sky-200">Branch</label>
                  <select className="input" value={form.branch_code} onChange={e => handleBranchSelect(e.target.value)}>
                    <option value="">Select branch...</option>
                    {branchOptions.map(b => <option key={b.value} value={b.value}>{b.label}</option>)}
                  </select>
                </div>
                <div className="sm:col-span-3"><label className="label">Branch Name</label><input className="input" readOnly value={form.branch_name} /></div>
                <div><label className="label">Area</label><input className="input" readOnly value={form.area} /></div>
                <div><label className="label">Region</label><input className="input" readOnly value={form.region} /></div>
                <div><label className="label">Division</label><input className="input" readOnly value={form.division} /></div>
                <div><label className="label">Operation</label><input className="input" readOnly value={form.operation} /></div>
              </div>
            </div>

            <div className="flex gap-2 mt-6 justify-end">
              <button onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>
              <button onClick={handleSave} disabled={addStaff.isPending} className="btn-primary">Save Record</button>
            </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
