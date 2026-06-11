import { useMemo } from 'react'
import { useStaff } from '../../hooks/useStaff'
import { useBranchOptions } from '../../hooks/useBranches'
import SegmentedSearchSelect from './SegmentedSearchSelect'

export default function FilterBar({ value = {}, onChange }) {
  const { data: staff = [] } = useStaff()
  const branchOptions = useBranchOptions()

  const unique = (key, filter = {}) => {
    let filtered = staff
    if (filter.operation) filtered = filtered.filter(s => s.operation === filter.operation)
    if (filter.division)  filtered = filtered.filter(s => s.division  === filter.division)
    if (filter.region)    filtered = filtered.filter(s => s.region    === filter.region)
    if (filter.area)      filtered = filtered.filter(s => s.area      === filter.area)
    return [...new Set(filtered.map(s => s[key]).filter(Boolean))].sort()
  }

  const operations = useMemo(() => unique('operation'), [staff])
  const divisions  = useMemo(() => unique('division',  { operation: value.operation }), [staff, value.operation])
  const regions    = useMemo(() => unique('region',    { operation: value.operation, division: value.division }), [staff, value.operation, value.division])
  const areas      = useMemo(() => unique('area',      { operation: value.operation, division: value.division, region: value.region }), [staff, value.operation, value.division, value.region])

  // Narrow branches based on staff in filtered hierarchy
  const filteredBranches = useMemo(() => {
    if (!value.operation && !value.division && !value.region && !value.area) return branchOptions
    const codes = new Set(
      staff
        .filter(s =>
          (!value.operation || s.operation === value.operation) &&
          (!value.division  || s.division  === value.division)  &&
          (!value.region    || s.region    === value.region)     &&
          (!value.area      || s.area      === value.area)
        )
        .map(s => s.branch_code)
        .filter(Boolean)
    )
    return branchOptions.filter(b => codes.has(b.value))
  }, [staff, branchOptions, value])

  const set = (key, val) => {
    const next = { ...value, [key]: val }
    // Reset downstream when upstream changes
    if (key === 'operation') { next.division = ''; next.region = ''; next.area = ''; next.branchCode = '' }
    if (key === 'division')  { next.region = ''; next.area = ''; next.branchCode = '' }
    if (key === 'region')    { next.area = ''; next.branchCode = '' }
    if (key === 'area')      { next.branchCode = '' }
    onChange(next)
  }

  const options = (list) => list.map(item => ({ value: item, label: item }))

  return (
    <div className="flex flex-wrap gap-2">
      <SegmentedSearchSelect label="Operation" value={value.operation || ''} options={options(operations)} onChange={val => set('operation', val)} />
      <SegmentedSearchSelect label="Division" value={value.division || ''} options={options(divisions)} onChange={val => set('division', val)} />
      <SegmentedSearchSelect label="Region" value={value.region || ''} options={options(regions)} onChange={val => set('region', val)} />
      <SegmentedSearchSelect label="Area" value={value.area || ''} options={options(areas)} onChange={val => set('area', val)} />
      <SegmentedSearchSelect label="Branch" value={value.branchCode || ''} options={filteredBranches} onChange={val => set('branchCode', val)} className="w-[260px]" />
    </div>
  )
}
