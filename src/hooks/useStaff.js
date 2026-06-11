import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { toTitleCase } from '../lib/utils'
import { useMemo } from 'react'

export function useStaff(filters = {}) {
  return useQuery({
    queryKey: ['staff', filters],
    queryFn: async () => {
      let q = supabase.from('staff').select('*').order('last_name')
      if (filters.operation) q = q.eq('operation', filters.operation)
      if (filters.division)  q = q.eq('division',  filters.division)
      if (filters.region)    q = q.eq('region',    filters.region)
      if (filters.area)      q = q.eq('area',      filters.area)
      if (filters.branchCode) q = q.eq('branch_code', filters.branchCode)
      if (filters.search) {
        q = q.or(`last_name.ilike.%${filters.search}%,first_name.ilike.%${filters.search}%,id.ilike.%${filters.search}%`)
      }
      const { data, error } = await q
      if (error) throw error
      return (data || []).map((s) => {
        // Fix text encoding issues for "ñ" and "Ñ" globally
        const replacementChar = String.fromCharCode(65533)
        const fix = str => {
          let s = String(str || '').replace(/Ã±/g, 'ñ').replace(/Ã‘/g, 'Ñ').replace(/([A-Z])\ufffd/g, '$1Ñ').replace(/\ufffd/g, 'ñ')
          return s.split(replacementChar).join('ñ').replace(/DASMARIñAS/gi, 'DASMARIÑAS').replace(/LAS PIñAS/gi, 'LAS PIÑAS').replace(/PARAñAQUE/gi, 'PARAÑAQUE')
        }
        const ln = fix(s.last_name)
        const fn = fix(s.first_name)
        const bn = fix(s.branch_name)
        return {
          ...s,
          last_name: ln,
          first_name: fn,
          branch_name: bn,
          name: toTitleCase(`${ln}, ${fn}`),
          branch: s.branch_code && bn ? `${s.branch_code} - ${bn}` : bn || s.branch_code || '',
        }
      })
    },
    staleTime: 60000,
  })
}

export function useStaffFilters() {
  const { data: staff = [] } = useStaff()
  return useMemo(() => {
    const unique = (key) => [...new Set(staff.map((s) => s[key]).filter(Boolean))].sort()
    return {
      operations: unique('operation'),
      divisions:  unique('division'),
      regions:    unique('region'),
      areas:      unique('area'),
    }
  }, [staff])
}

export function useAddStaff() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (data) => {
      const { error } = await supabase.from('staff').insert(data)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['staff'] }),
  })
}

export function useDeleteStaff() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from('staff').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['staff'] }),
  })
}
