import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { getTime } from '../lib/utils'
import { buildWorkflowInfoHtml } from '../lib/security'
import { logAudit } from '../lib/audit'
import { useAuthStore } from '../store/authStore'

const TABLE_MAP = {
  initiatives: 'cost_center_initiatives',
  cfoo: 'cost_center_cfoo',
  other: 'cost_center_other',
}

const invalidateWorkflowQueries = (qc, table) => {
  qc.invalidateQueries({ queryKey: [table] })
  qc.invalidateQueries({ queryKey: ['dashboard'] })
  qc.invalidateQueries({ queryKey: ['pending-counts'] })
  qc.invalidateQueries({ queryKey: ['action-center'] })
}

export function useCostCenter(type) {
  const table = TABLE_MAP[type]
  return useQuery({
    queryKey: [table],
    queryFn: async () => {
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .order('date', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })
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
        uploader_info: buildWorkflowInfoHtml(user?.full_name, getTime()),
      })
      if (error) throw error
    },
    onSuccess: () => invalidateWorkflowQueries(qc, table),
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
    onSuccess: () => invalidateWorkflowQueries(qc, table),
  })
}

export function useDeleteCostCenter(type) {
  const qc = useQueryClient()
  const table = TABLE_MAP[type]

  return useMutation({
    mutationFn: async (uniqId) => {
      const { data: before } = await supabase.from(table).select('*').eq('uniq_id', uniqId).maybeSingle()
      const { error } = await supabase.from(table).delete().eq('uniq_id', uniqId)
      if (error) throw error
      await logAudit({ user: useAuthStore.getState().user, action: `DELETE_${type.toUpperCase()}_COST_CENTER`, module: table, recordId: uniqId, before })
    },
    onSuccess: () => invalidateWorkflowQueries(qc, table),
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
    onSuccess: () => invalidateWorkflowQueries(qc, table),
  })
}

export function useProcessCostCenter(type) {
  const qc = useQueryClient()
  const table = TABLE_MAP[type]
  const user = useAuthStore((s) => s.user)

  return useMutation({
    mutationFn: async ({ uniqId, action, payload = {} }) => {
      const info = buildWorkflowInfoHtml(user?.full_name, getTime())
      let updates = { updated_at: new Date().toISOString() }
      const { data: before } = await supabase.from(table).select('uniq_id,status,amount,remarks,file_id').eq('uniq_id', uniqId).maybeSingle()

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
      await logAudit({ user, action: `${action}_${type.toUpperCase()}_COST_CENTER`, module: table, recordId: uniqId, before, after: updates })
    },
    onSuccess: () => invalidateWorkflowQueries(qc, table),
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
