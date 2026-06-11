import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { getTime } from '../lib/utils'
import { useAuthStore } from '../store/authStore'

const TABLE_MAP = { it: 'it_expenses', at: 'at_expenses', comms: 'comms_expenses' }

export function useExpenses(type, filters = {}) {
  const table = TABLE_MAP[type]
  return useQuery({
    queryKey: [table, filters],
    queryFn: async () => {
      let q = supabase.from(table).select('*').order('created_at', { ascending: false })
      if (filters.status && filters.status !== 'All')   q = q.eq('status', filters.status)
      if (filters.category && filters.category !== 'All') q = q.eq('category', filters.category)
      if (filters.branchCode) q = q.eq('branch_code', filters.branchCode)
      if (filters.dateStart)  q = q.gte('date', filters.dateStart)
      if (filters.dateEnd)    q = q.lte('date', filters.dateEnd)
      if (filters.search) {
        q = q.or(`branch_name.ilike.%${filters.search}%,item_name.ilike.%${filters.search}%,account_title.ilike.%${filters.search}%,branch_code.ilike.%${filters.search}%`)
      }
      const { data, error } = await q
      if (error) throw error
      return data || []
    },
    staleTime: 30000,
  })
}

export function useCreateExpense(type) {
  const qc = useQueryClient()
  const table = TABLE_MAP[type]
  const user = useAuthStore((s) => s.user)
  return useMutation({
    mutationFn: async (payload) => {
      const uniqId = String(Date.now())
      const shortCat = (payload.category || '').substring(0, 3).toUpperCase()
      const { error } = await supabase.from(table).insert({
        uniq_id: uniqId,
        category: payload.category,
        date: payload.date,
        branch_code: payload.branchCode?.toUpperCase(),
        branch_name: payload.branchName,
        account_title: payload.accountTitle,
        item_name: payload.itemName,
        description: payload.description,
        amount: payload.amount || 0,
        status: 'Pending',
        uploader: user?.full_name,
        uploader_info: `<b>${user?.full_name}</b><br><span style="font-size:10px;color:#64748b">${getTime()}</span>`,
      })
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [table] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

export function useUpdateExpense(type) {
  const qc = useQueryClient()
  const table = TABLE_MAP[type]
  return useMutation({
    mutationFn: async ({ uniqId, updates }) => {
      const { error } = await supabase.from(table).update({ ...updates, updated_at: new Date().toISOString() }).eq('uniq_id', uniqId)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [table] }),
  })
}

export function useDeleteExpense(type) {
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

export function useProcessExpense(type) {
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
      await supabase.from('audit_logs').insert({ user_name: user?.full_name, action: `${action}_${type.toUpperCase()}`, details: uniqId })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [table] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

export function useAttachFileExpense(type) {
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

export function useBatchProcessExpense(type) {
  const qc = useQueryClient()
  const table = TABLE_MAP[type]
  const user = useAuthStore((s) => s.user)
  return useMutation({
    mutationFn: async ({ ids, action }) => {
      const info = `<b>${user?.full_name}</b><br><span style="font-size:10px;color:#64748b">${getTime()}</span>`
      const requiredStatus = action === 'OPS_CHECK' ? 'Pending' : 'Checked'
      const newStatus = action === 'OPS_CHECK' ? 'Checked' : 'Approved'
      const infoField = action === 'OPS_CHECK' ? 'ops_info' : 'fin_info'

      const { error } = await supabase
        .from(table)
        .update({ status: newStatus, [infoField]: info, updated_at: new Date().toISOString() })
        .in('uniq_id', ids)
        .eq('status', requiredStatus)

      if (error) throw error
      await supabase.from('audit_logs').insert({ user_name: user?.full_name, action: `BATCH_${action}_${type.toUpperCase()}`, details: `${ids.length} items` })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [table] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}
