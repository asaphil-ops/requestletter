import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { normalizeID, getTime } from '../lib/utils'
import { useAuthStore } from '../store/authStore'

export function useRequests(filters = {}) {
  return useQuery({
    queryKey: ['requests', filters],
    queryFn: async () => {
      let q = supabase.from('requests').select('*').order('created_at', { ascending: false })
      if (filters.status && filters.status !== 'All') q = q.eq('status', filters.status)
      if (filters.dateStart) q = q.gte('date_req', filters.dateStart)
      if (filters.dateEnd)   q = q.lte('date_req', filters.dateEnd)
      if (filters.search)    q = q.or(`title.ilike.%${filters.search}%,beneficiary.ilike.%${filters.search}%`)
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
        uploader_info: `<b>${user?.full_name}</b><br><span style="font-size:10px;color:#64748b">${getTime()}</span>`,
      })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['requests'] }),
  })
}

export function useUpdateRequest() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ reqId, updates }) => {
      const { error } = await supabase.from('requests').update({ ...updates, updated_at: new Date().toISOString() }).eq('req_id', reqId)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['requests'] }),
  })
}

export function useDeleteRequest() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (reqId) => {
      const { error } = await supabase.from('requests').delete().eq('req_id', reqId)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['requests'] }),
  })
}

export function useProcessRequest() {
  const qc = useQueryClient()
  const user = useAuthStore((s) => s.user)
  return useMutation({
    mutationFn: async ({ reqId, action, payload = {} }) => {
      const info = `<b>${user?.full_name}</b><br><span style="font-size:10px;color:#64748b">${getTime()}</span>`
      let updates = { updated_at: new Date().toISOString() }

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

      // Log
      await supabase.from('audit_logs').insert({ user_name: user?.full_name, action, details: reqId })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['requests'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
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
