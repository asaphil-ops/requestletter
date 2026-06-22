import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

const TABLE = 'employee_list'
const PAGE_SIZE = 1000

export function useEmployeeList() {
  return useQuery({
    queryKey: [TABLE],
    queryFn: async () => {
      const all = []
      let from = 0
      while (true) {
        const { data, error } = await supabase
          .from(TABLE)
          .select('*')
          .order('id_number', { ascending: false })
          .range(from, from + PAGE_SIZE - 1)
        if (error) throw error
        if (!data || data.length === 0) break
        all.push(...data)
        if (data.length < PAGE_SIZE) break
        from += PAGE_SIZE
      }
      return all
    },
    staleTime: 30000,
  })
}

export function useCreateEmployee() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload) => {
      const { error } = await supabase.from(TABLE).insert(payload)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [TABLE] }),
  })
}

export function useBulkUpsertEmployees() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (rows) => {
      const { error } = await supabase.from(TABLE).upsert(rows, { onConflict: 'id_number' })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [TABLE] }),
  })
}

export function useUpdateEmployee() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, updates }) => {
      const { error } = await supabase.from(TABLE).update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [TABLE] }),
  })
}

export function useDeleteEmployee() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from(TABLE).delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [TABLE] }),
  })
}
