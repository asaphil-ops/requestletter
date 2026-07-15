import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { getTime } from '../lib/utils'
import { fetchAllPages } from '../lib/supabasePagination'
import { buildWorkflowInfoHtml, escapePostgrestSearch } from '../lib/security'
import { logAudit } from '../lib/audit'
import { useAuthStore } from '../store/authStore'

const TABLE_MAP = { it: 'it_expenses', at: 'at_expenses', generator: 'generator_expenses', comms: 'comms_expenses' }

const invalidateWorkflowQueries = (qc, table) => {
  qc.invalidateQueries({ queryKey: [table] })
  qc.invalidateQueries({ queryKey: ['dashboard'] })
  qc.invalidateQueries({ queryKey: ['pending-counts'] })
  qc.invalidateQueries({ queryKey: ['action-center'] })
}

export function useExpenses(type, filters = {}) {
  const table = TABLE_MAP[type]
  return useQuery({
    queryKey: [table, filters],
    queryFn: async () => {
      const buildQuery = () => {
        let q = supabase.from(table).select('*').order('created_at', { ascending: false })
        if (filters.status && filters.status !== 'All')   q = q.eq('status', filters.status)
        if (filters.category && filters.category !== 'All') q = q.eq('category', filters.category)
        if (filters.branchCode) q = q.eq('branch_code', filters.branchCode)
        if (filters.dateStart)  q = q.gte('date', filters.dateStart)
        if (filters.dateEnd)    q = q.lte('date', filters.dateEnd)
        if (filters.search) {
          const search = escapePostgrestSearch(filters.search)
          if (search) q = q.or(`branch_name.ilike.%${search}%,item_name.ilike.%${search}%,account_title.ilike.%${search}%,branch_code.ilike.%${search}%`)
        }
        return q
      }
      return fetchAllPages(buildQuery)
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
        uploader_info: buildWorkflowInfoHtml(user?.full_name, getTime()),
      })
      if (error) throw error
    },
    onSuccess: () => {
      invalidateWorkflowQueries(qc, table)
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
    onSuccess: () => invalidateWorkflowQueries(qc, table),
  })
}

export function useDeleteExpense(type) {
  const qc = useQueryClient()
  const table = TABLE_MAP[type]
  return useMutation({
    mutationFn: async (uniqId) => {
      const { data: before } = await supabase.from(table).select('*').eq('uniq_id', uniqId).maybeSingle()
      const { error } = await supabase.from(table).delete().eq('uniq_id', uniqId)
      if (error) throw error
      await logAudit({ user: useAuthStore.getState().user, action: `DELETE_${type.toUpperCase()}`, module: table, recordId: uniqId, before })
    },
    onSuccess: () => invalidateWorkflowQueries(qc, table),
  })
}

export function useProcessExpense(type) {
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
      await logAudit({ user, action: `${action}_${type.toUpperCase()}`, module: table, recordId: uniqId, before, after: updates })
    },
    onSuccess: () => {
      invalidateWorkflowQueries(qc, table)
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
      const info = buildWorkflowInfoHtml(user?.full_name, getTime())
      const requiredStatus = action === 'OPS_CHECK' ? 'Pending' : 'Checked'
      const newStatus = action === 'OPS_CHECK' ? 'Checked' : 'Approved'
      const infoField = action === 'OPS_CHECK' ? 'ops_info' : 'fin_info'

      const { error } = await supabase
        .from(table)
        .update({ status: newStatus, [infoField]: info, updated_at: new Date().toISOString() })
        .in('uniq_id', ids)
        .eq('status', requiredStatus)

      if (error) throw error
      await logAudit({ user, action: `BATCH_${action}_${type.toUpperCase()}`, module: table, recordId: ids.join(','), after: { status: newStatus, count: ids.length } })
    },
    onSuccess: () => {
      invalidateWorkflowQueries(qc, table)
    },
  })
}
