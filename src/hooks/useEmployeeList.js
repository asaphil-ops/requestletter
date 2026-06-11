import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

const TABLE = 'employee_list'

export function useEmployeeList() {
  return useQuery({
    queryKey: [TABLE],
    queryFn: async () => {
      const { data, error } = await supabase
        .from(TABLE)
        .select('*')
        .order('full_name', { ascending: true })
      if (error) throw error
      return data || []
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
