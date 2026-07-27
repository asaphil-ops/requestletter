import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { normalizeID, getTime } from '../lib/utils'
import { fetchAllPages } from '../lib/supabasePagination'
import { buildWorkflowInfoHtml, escapePostgrestSearch } from '../lib/security'
import { logAudit } from '../lib/audit'
import { useAuthStore } from '../store/authStore'

const invalidateWorkflowQueries = (qc) => {
  qc.invalidateQueries({ queryKey: ['sbar'] })
  qc.invalidateQueries({ queryKey: ['dashboard'] })
  qc.invalidateQueries({ queryKey: ['pending-counts'] })
  qc.invalidateQueries({ queryKey: ['action-center'] })
}

export function useSbar(filters = {}) {
  return useQuery({
    queryKey: ['sbar', filters],
    queryFn: async () => {
      const buildQuery = () => {
        let q = supabase.from('sbar').select('*').order('created_at', { ascending: false })
        if (filters.status && filters.status !== 'All') q = q.eq('status', filters.status)
        if (filters.type && filters.type !== 'All')     q = q.eq('type',   filters.type)
        if (filters.dateStart) q = q.gte('date', filters.dateStart)
        if (filters.dateEnd)   q = q.lte('date', filters.dateEnd)
        if (filters.search) {
          const search = escapePostgrestSearch(filters.search)
          if (search) q = q.or(`giver.ilike.%${search}%,receiver.ilike.%${search}%`)
        }
        return q
      }
      return fetchAllPages(buildQuery)
    },
    staleTime: 30000,
  })
}

export function useCreateSbar() {
  const qc = useQueryClient()
  const user = useAuthStore((s) => s.user)
  return useMutation({
    mutationFn: async (payload) => {
      const uniqId = normalizeID(payload.uniqId || Date.now().toString())
      const { error } = await supabase.from('sbar').insert({
        uniq_id: uniqId,
        type: payload.type,
        date: payload.date,
        giver: payload.giver,
        receiver: payload.receiver,
        giver_title: payload.giverTitle,
        receiver_title: payload.receiverTitle,
        description: payload.description,
        amount: payload.amount || 0,
        status: 'Pending',
        uploader: user?.full_name,
        uploader_info: buildWorkflowInfoHtml(user?.full_name, getTime()),
      })
      if (error) throw error
    },
    onSuccess: () => invalidateWorkflowQueries(qc),
  })
}

export function useUpdateSbar() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ uniqId, updates }) => {
      const mapped = {
        type: updates.type,
        date: updates.date,
        giver: updates.giver,
        receiver: updates.receiver,
        giver_title: updates.giverTitle,
        receiver_title: updates.receiverTitle,
        description: updates.description,
        amount: updates.amount,
        updated_at: new Date().toISOString()
      }
      const { error } = await supabase.from('sbar').update(mapped).eq('uniq_id', uniqId)
      if (error) throw error
    },
    onSuccess: () => invalidateWorkflowQueries(qc),
  })
}

export function useDeleteSbar() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (uniqId) => {
      const { data: before } = await supabase.from('sbar').select('*').eq('uniq_id', uniqId).maybeSingle()
      const { error } = await supabase.from('sbar').delete().eq('uniq_id', uniqId)
      if (error) throw error
      await logAudit({ user: useAuthStore.getState().user, action: 'DELETE_SBAR', module: 'SBAR', recordId: uniqId, before })
    },
    onSuccess: () => invalidateWorkflowQueries(qc),
  })
}

export function useProcessSbar() {
  const qc = useQueryClient()
  const user = useAuthStore((s) => s.user)
  return useMutation({
    mutationFn: async ({ uniqId, action, payload = {} }) => {
      const info = buildWorkflowInfoHtml(user?.full_name, getTime())
      let updates = { updated_at: new Date().toISOString() }
      const { data: before } = await supabase.from('sbar').select('uniq_id,status,amount,remarks,file_id').eq('uniq_id', uniqId).maybeSingle()

      if (action === 'OPS_CHECK') {
        updates.status = 'Checked'
        updates.ops_info = info
      } else if (action === 'OPS_FORWARD') {
        updates.status = 'Forwarded to OPS Planning'
        updates.ops_info = info
      } else if (action === 'FINANCE_APPROVE') {
        updates.status = 'Approved'
        updates.fin_info = info
        if (payload.amount) updates.amount = payload.amount
      } else if (action.includes('REJECT')) {
        updates.status = 'Rejected'
        updates.remarks = `${payload.note || ''} (${user?.full_name})`
      }

      const { error } = await supabase.from('sbar').update(updates).eq('uniq_id', uniqId)
      if (error) throw error
      await logAudit({ user, action: 'SBAR_' + action, module: 'SBAR', recordId: uniqId, before, after: updates })
    },
    onSuccess: () => {
      invalidateWorkflowQueries(qc)
    },
  })
}
