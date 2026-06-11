import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

const TABLE = 'initiative_account_mappings'

export function useInitiativeMappings() {
  return useQuery({
    queryKey: [TABLE],
    queryFn: async () => {
      const { data, error } = await supabase
        .from(TABLE)
        .select('*')
        .order('particular', { ascending: true })
        .order('sub_account', { ascending: true })
      if (error) throw error
      return data || []
    },
    staleTime: 30000,
  })
}

export function useCreateInitiativeMapping() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload) => {
      const { error } = await supabase.from(TABLE).insert(payload)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [TABLE] }),
  })
}

export function useBulkUpsertInitiativeMappings() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (rows) => {
      const { error } = await supabase
        .from(TABLE)
        .upsert(rows, { onConflict: 'particular,sub_account' })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [TABLE] }),
  })
}

export function useUpdateInitiativeMapping() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, updates }) => {
      const { error } = await supabase.from(TABLE).update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [TABLE] }),
  })
}

export function useDeleteInitiativeMapping() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from(TABLE).delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [TABLE] }),
  })
}
