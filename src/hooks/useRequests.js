import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { normalizeID, getTime } from '../lib/utils'
import { buildWorkflowInfoHtml, escapePostgrestSearch } from '../lib/security'
import { logAudit } from '../lib/audit'
import { useAuthStore } from '../store/authStore'

const invalidateWorkflowQueries = (qc) => {
  qc.invalidateQueries({ queryKey: ['requests'] })
  qc.invalidateQueries({ queryKey: ['dashboard'] })
  qc.invalidateQueries({ queryKey: ['pending-counts'] })
  qc.invalidateQueries({ queryKey: ['action-center'] })
}

export function useRequests(filters = {}) {
  return useQuery({
    queryKey: ['requests', filters],
    queryFn: async () => {
      let q = supabase.from('requests').select('*').order('created_at', { ascending: false })
      if (filters.status && filters.status !== 'All') q = q.eq('status', filters.status)
      if (filters.dateStart) q = q.gte('date_req', filters.dateStart)
      if (filters.dateEnd)   q = q.lte('date_req', filters.dateEnd)
      if (filters.search) {
        const search = escapePostgrestSearch(filters.search)
        if (search) q = q.or(`title.ilike.%${search}%,beneficiary.ilike.%${search}%`)
      }
      const { data, error } = await q
      if (error) throw error
      return data || []
    },
    staleTime: 30000,
  })
}

export function useCreateRequest() {
  const qc = useQueryClient()
  const user = useAuthStore((s) => s.user)
  return useMutation({
    mutationFn: async (payload) => {
      const reqId = normalizeID(payload.reqId || Date.now().toString())
      const { error } = await supabase.from('requests').insert({
        req_id: reqId,
        type: payload.type,
        beneficiary: payload.beneficiary,
        date_req: payload.date_req,
        title: payload.title,
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

export function useUpdateRequest() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ reqId, updates }) => {
      const { error } = await supabase.from('requests').update({ ...updates, updated_at: new Date().toISOString() }).eq('req_id', reqId)
      if (error) throw error
    },
    onSuccess: () => invalidateWorkflowQueries(qc),
  })
}

export function useDeleteRequest() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (reqId) => {
      const { data: before } = await supabase.from('requests').select('*').eq('req_id', reqId).maybeSingle()
      const { error } = await supabase.from('requests').delete().eq('req_id', reqId)
      if (error) throw error
      await logAudit({ user: useAuthStore.getState().user, action: 'DELETE_REQUEST', module: 'Request Letter', recordId: reqId, before })
    },
    onSuccess: () => invalidateWorkflowQueries(qc),
  })
}

export function useProcessRequest() {
  const qc = useQueryClient()
  const user = useAuthStore((s) => s.user)
  return useMutation({
    mutationFn: async ({ reqId, action, payload = {} }) => {
      const info = buildWorkflowInfoHtml(user?.full_name, getTime())
      let updates = { updated_at: new Date().toISOString() }
      const { data: before } = await supabase.from('requests').select('req_id,status,amount,remarks,file_id').eq('req_id', reqId).maybeSingle()

      if (action === 'OPS_CHECK') {
        updates.status = 'Checked'
        updates.ops_info = info
      } else if (action === 'FINANCE_APPROVE') {
        updates.status = 'Checked'
        updates.fin_info = info
        if (payload.amount) updates.amount = payload.amount
      } else if (action.includes('REJECT')) {
        updates.status = 'Rejected'
        updates.remarks = `${payload.note || ''} (${user?.full_name})`
      }

      const { error } = await supabase.from('requests').update(updates).eq('req_id', reqId)
      if (error) throw error

      await logAudit({ user, action, module: 'Request Letter', recordId: reqId, before, after: updates })
    },
    onSuccess: () => {
      invalidateWorkflowQueries(qc)
    },
  })
}

export function useAttachFile() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ reqId, fileId }) => {
      const { error } = await supabase.from('requests').update({ file_id: fileId }).eq('req_id', reqId)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['requests'] }),
  })
}
