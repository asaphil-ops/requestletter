import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useMemo } from 'react'

const BRANCH_PAGE_SIZE = 1000

export async function fetchAllBranches() {
  const rows = []

  for (let from = 0; ; from += BRANCH_PAGE_SIZE) {
    const { data, error } = await supabase
      .from('branches')
      .select('*')
      .order('branch_code', { ascending: true })
      .range(from, from + BRANCH_PAGE_SIZE - 1)

    if (error) throw error

    rows.push(...(data || []))
    if (!data || data.length < BRANCH_PAGE_SIZE) break
  }

  return rows.map(normalizeBranch)
}

export function useBranches() {
  return useQuery({
    queryKey: ['branches'],
    queryFn: fetchAllBranches,
    staleTime: 5 * 60 * 1000,
  })
}

export function normalizeBranch(branch) {
  const code = String(branch.code || branch.branch_code || branch.branchCode || '').trim().toUpperCase()
  let name = String(branch.name || branch.branch_name || branch.branchName || '').trim()

  // Fix common text encoding issues for "ñ" and "Ñ" 
  name = name.replace(/Ã±/g, 'ñ')
             .replace(/Ã‘/g, 'Ñ')
             .replace(/([A-Z])\ufffd/g, '$1Ñ')
             .replace(/\ufffd/g, 'ñ')
             
  // Also try replacing the literal replacement character using char code
  const replacementChar = String.fromCharCode(65533)
  name = name.split(replacementChar).join('Ñ')
  // Fix specifically for known uppercase cities if they were lowercased
  name = name.replace(/DASMARIñAS/gi, 'DASMARIÑAS')
             .replace(/LAS PIñAS/gi, 'LAS PIÑAS')
             .replace(/PARAñAQUE/gi, 'PARAÑAQUE')

  return {
    ...branch,
    code,
    name,
    branch_code: branch.branch_code || code,
    branch_name: branch.branch_name || name,
  }
}

export function useBranchMap() {
  const { data: branches = [] } = useBranches()
  return useMemo(() => {
    const map = {}
    branches.forEach((b) => {
      const branch = normalizeBranch(b)
      if (branch.code) map[branch.code] = branch
    })
    return map
  }, [branches])
}

export function useBranchEmailMap() {
  const { data: branches = [] } = useBranches()
  return useMemo(() => {
    const map = {}
    branches.forEach((b) => {
      const branch = normalizeBranch(b)
      if (branch.code && branch.email) map[branch.code] = branch.email
    })
    return map
  }, [branches])
}

export function useBranchOptions() {
  const { data: branches = [] } = useBranches()
  return useMemo(() =>
    branches
      .map(normalizeBranch)
      .filter((b) => b.code && b.name)
      .map((b) => ({ ...b, value: b.code, label: `${b.code} - ${b.name}` }))
      .sort((a, b) => a.label.localeCompare(b.label)),
    [branches]
  )
}
