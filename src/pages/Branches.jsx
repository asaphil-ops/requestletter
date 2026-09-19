import { useMemo, useState } from 'react'
import Swal from 'sweetalert2'
import { useBranches, useCreateBranch, useDeleteBranch, useUpdateBranch } from '../hooks/useBranches'
import { EmptyRow, TableLoader } from '../components/shared/Loader'
import Pagination from '../components/shared/Pagination'
import SegmentedSearchSelect from '../components/shared/SegmentedSearchSelect'
import { ROWS_PER_PAGE } from '../lib/utils'

const EMPTY_FORM = { code: '', name: '', area: '', region: '', division: '', operation: '', email: '' }
const FIELDS = [['code', 'Branch No.', true], ['name', 'Branch Name', true], ['area', 'Area'], ['region', 'Region'], ['division', 'Division'], ['operation', 'Operation'], ['email', 'Email']]

export default function Branches() {
  const { data: branches = [], isLoading } = useBranches()
  const createBranch = useCreateBranch()
  const updateBranch = useUpdateBranch()
  const deleteBranch = useDeleteBranch()
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState({ operation: '', division: '', region: '', area: '', branchCode: '' })
  const [page, setPage] = useState(1)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)

  const options = useMemo(() => Object.fromEntries(['operation', 'division', 'region', 'area'].map(key => [key, [...new Set(branches.map(b => b[key]).filter(Boolean))].sort()])), [branches])
  const filtered = useMemo(() => branches.filter(branch => {
    const haystack = [branch.code, branch.name, branch.area, branch.region, branch.division, branch.operation, branch.email].join(' ').toLowerCase()
    return haystack.includes(search.toLowerCase()) && Object.entries(filters).every(([key, value]) => !value || (key === 'branchCode' ? branch.code === value : branch[key] === value))
  }), [branches, search, filters])
  const paged = filtered.slice((page - 1) * ROWS_PER_PAGE, page * ROWS_PER_PAGE)
  const open = (branch = null) => {
    setEditing(branch)
    setForm(branch ? { code: branch.code || '', name: branch.name || '', area: branch.area || '', region: branch.region || '', division: branch.division || '', operation: branch.operation || '', email: branch.email || '' } : EMPTY_FORM)
  }
  const save = async () => {
    const payload = Object.fromEntries(Object.entries(form).map(([key, value]) => [key, String(value || '').trim()]))
    payload.code = payload.code.toUpperCase()
    if (!payload.code || !payload.name) return Swal.fire('Missing fields', 'Branch No. and Branch Name are required.', 'warning')
    try {
      if (editing) {
        const { code, ...updates } = payload
        await updateBranch.mutateAsync({ code: editing.code, updates })
      } else await createBranch.mutateAsync(payload)
      setEditing(null)
      Swal.fire('Saved', 'Branch record saved successfully.', 'success')
    } catch (error) { Swal.fire('Error', error.message, 'error') }
  }
  const remove = async (branch) => {
    const result = await Swal.fire({ title: `Delete ${branch.code}?`, text: 'This cannot be undone.', icon: 'warning', showCancelButton: true, confirmButtonText: 'Delete', confirmButtonColor: '#ef4444' })
    if (!result.isConfirmed) return
    try { await deleteBranch.mutateAsync(branch.code); Swal.fire('Deleted', '', 'success') } catch (error) { Swal.fire('Error', error.message, 'error') }
  }
  const updateFilter = (key, value) => { setFilters(prev => ({ ...prev, [key]: value })); setPage(1) }
  const exportCSV = () => {
    const rows = [
      ['Branch No.', 'Branch Name', 'Area', 'Region', 'Division', 'Operation', 'Email'],
      ...filtered.map(branch => [branch.code, branch.name, branch.area, branch.region, branch.division, branch.operation, branch.email]),
    ]
    const csv = rows.map(row => row.map(value => `"${String(value || '').replace(/"/g, '""')}"`).join(',')).join('\n')
    const link = document.createElement('a')
    link.href = `data:text/csv;charset=utf-8,\uFEFF${encodeURIComponent(csv)}`
    link.download = `branches_${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
  }

  return <div>
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-2xl font-extrabold text-gray-900 dark:text-gray-100">Branches</h1><p className="text-sm font-semibold text-gray-500">Manage branch and geographic reference data</p></div><div className="flex gap-2"><button onClick={exportCSV} className="btn-secondary text-xs px-3 py-2"><i className="fas fa-file-csv mr-1 text-emerald-600" />Export CSV</button><button onClick={() => open()} className="btn-primary text-xs px-3 py-2"><i className="fas fa-plus mr-1" />New Branch</button></div></div>
    <div className="card mb-4 p-4"><div className="flex flex-wrap gap-2"><div className="relative min-w-[190px] flex-1"><i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400" /><input className="input pl-9" value={search} placeholder="Search branches..." onChange={e => { setSearch(e.target.value); setPage(1) }} /></div><SegmentedSearchSelect label="Operation" value={filters.operation} options={options.operation.map(value => ({ value, label: value }))} onChange={value => updateFilter('operation', value)} /><SegmentedSearchSelect label="Division" value={filters.division} options={options.division.map(value => ({ value, label: value }))} onChange={value => updateFilter('division', value)} /><SegmentedSearchSelect label="Region" value={filters.region} options={options.region.map(value => ({ value, label: value }))} onChange={value => updateFilter('region', value)} /><SegmentedSearchSelect label="Area" value={filters.area} options={options.area.map(value => ({ value, label: value }))} onChange={value => updateFilter('area', value)} /><SegmentedSearchSelect label="Branch" value={filters.branchCode} options={branches.map(branch => ({ value: branch.code, label: `${branch.code} - ${branch.name}` }))} onChange={value => updateFilter('branchCode', value)} className="w-[290px]" />{(search || Object.values(filters).some(Boolean)) && <button onClick={() => { setSearch(''); setFilters({ operation: '', division: '', region: '', area: '', branchCode: '' }); setPage(1) }} className="btn-secondary px-3 py-1.5 text-xs"><i className="fas fa-rotate-right mr-1" />Reset</button>}</div></div>
    <div className="card overflow-hidden"><div className="max-h-[70vh] overflow-auto"><table className="w-full min-w-[1000px]"><thead className="sticky top-0 z-20 bg-white dark:bg-slate-900"><tr>{['#', 'Branch No.', 'Branch Name', 'Area', 'Region', 'Division', 'Operation', 'Email', 'Actions'].map(label => <th key={label} className="table-th">{label}</th>)}</tr></thead><tbody>{isLoading ? <TableLoader /> : !filtered.length ? <EmptyRow cols={9} /> : paged.map((branch, index) => <tr key={branch.code} className="table-tr"><td className="table-td text-xs text-gray-400">{(page - 1) * ROWS_PER_PAGE + index + 1}</td><td className="table-td font-semibold">{branch.code}</td><td className="table-td">{branch.name}</td><td className="table-td">{branch.area || '-'}</td><td className="table-td">{branch.region || '-'}</td><td className="table-td">{branch.division || '-'}</td><td className="table-td">{branch.operation || '-'}</td><td className="table-td text-xs">{branch.email || '-'}</td><td className="table-td"><div className="table-actions"><button onClick={() => open(branch)} className="btn-icon bg-gray-50 text-gray-500 hover:bg-gray-100" title="Edit"><i className="fas fa-pencil-alt" /></button><button onClick={() => remove(branch)} className="btn-icon bg-red-50 text-red-500 hover:bg-red-100" title="Delete"><i className="fas fa-trash" /></button></div></td></tr>)}</tbody></table></div><Pagination page={page} total={filtered.length} onChange={setPage} /></div>
    {editing !== null && <div className="modal-backdrop" onClick={() => setEditing(null)}><div className="modal-panel max-w-2xl" onClick={e => e.stopPropagation()}><div className="modal-header"><h3 className="modal-title">{editing ? 'Edit Branch' : 'New Branch'}</h3><p className="modal-subtitle">Branch reference information</p></div><div className="grid grid-cols-1 gap-3 p-5 sm:grid-cols-2">{FIELDS.map(([key, label, required]) => <div key={key} className={key === 'email' ? 'sm:col-span-2' : ''}><label className="label">{label}{required && <span className="text-red-500"> *</span>}</label><input className="input" type={key === 'email' ? 'email' : 'text'} value={form[key]} disabled={Boolean(editing && key === 'code')} onChange={e => setForm(prev => ({ ...prev, [key]: e.target.value }))} /></div>)}</div><div className="flex justify-end gap-2 border-t border-slate-200 bg-white px-5 py-4"><button onClick={() => setEditing(null)} className="btn-secondary">Cancel</button><button onClick={save} className="btn-primary" disabled={createBranch.isPending || updateBranch.isPending}>Save Branch</button></div></div></div>}
  </div>
}
