import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { getTime } from '../lib/utils'
import { useAuthStore } from '../store/authStore'

const TABLE_MAP = {
  initiatives: 'cost_center_initiatives',
  cfoo: 'cost_center_cfoo',
  other: 'cost_center_other',
}

export function useCostCenter(type) {
  const table = TABLE_MAP[type]
  return useQuery({
    queryKey: [table],
    queryFn: async () => {
      const { data, error } = await supabase.from(table).select('*').order('created_at', { ascending: false })
      if (error) throw error
      return data || []
    },
    staleTime: 30000,
  })
}

export function useCreateCostCenter(type) {
  const qc = useQueryClient()
  const table = TABLE_MAP[type]
  const user = useAuthStore((s) => s.user)

  return useMutation({
    mutationFn: async (payload) => {
      const { error } = await supabase.from(table).insert({
        uniq_id: String(Date.now()),
        ...payload,
        status: 'Pending',
        uploader: user?.full_name,
        uploader_info: `<b>${user?.full_name}</b><br><span style="font-size:10px;color:#64748b">${getTime()}</span>`,
      })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [table] }),
  })
}

export function useUpdateCostCenter(type) {
  const qc = useQueryClient()
  const table = TABLE_MAP[type]

  return useMutation({
    mutationFn: async ({ uniqId, updates }) => {
      const { error } = await supabase
        .from(table)
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('uniq_id', uniqId)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [table] }),
  })
}

export function useDeleteCostCenter(type) {
  const qc = useQueryClient()
  const table = TABLE_MAP[type]

  return useMutation({
    mutationFn: async (uniqId) => {
      const { error } = await supabase.from(table).delete().eq('uniq_id', uniqId)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [table] }),
  })
}

export function useBatchDeleteCostCenter(type) {
  const qc = useQueryClient()
  const table = TABLE_MAP[type]

  return useMutation({
    mutationFn: async (uniqIds) => {
      if (!uniqIds.length) return
      const { error } = await supabase.from(table).delete().in('uniq_id', uniqIds)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [table] }),
  })
}

export function useProcessCostCenter(type) {
  const qc = useQueryClient()
  const table = TABLE_MAP[type]
  const user = useAuthStore((s) => s.user)

  return useMutation({
    mutationFn: async ({ uniqId, action, payload = {} }) => {
      const info = `<b>${user?.full_name}</b><br><span style="font-size:10px;color:#64748b">${getTime()}</span>`
      let updates = { updated_at: new Date().toISOString() }

      if (action === 'OPS_CHECK') {
        updates.status = 'Checked'
        updates.ops_info = info
      } else if (action === 'FINANCE_APPROVE') {
        updates.status = 'Approved'
        updates.fin_info = info
        if (payload.amount) updates.amount = payload.amount
      } else if (action.includes('REJECT')) {
        updates.status = 'Rejected'
        updates.remarks = `${payload.note || ''} (${user?.full_name})`
      }

      const { error } = await supabase.from(table).update(updates).eq('uniq_id', uniqId)
      if (error) throw error
      await supabase.from('audit_logs').insert({ user_name: user?.full_name, action: `${action}_${type.toUpperCase()}_COST_CENTER`, details: uniqId })
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [table] }),
  })
}

export function useAttachFileCostCenter(type) {
  const qc = useQueryClient()
  const table = TABLE_MAP[type]

  return useMutation({
    mutationFn: async ({ uniqId, fileId }) => {
      const { error } = await supabase.from(table).update({ file_id: fileId }).eq('uniq_id', uniqId)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [table] }),
  })
}
