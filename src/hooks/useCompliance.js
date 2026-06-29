import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { logAudit } from '../lib/audit'
import { useAuthStore } from '../store/authStore'

const TABLE = 'compliance_certificates'
const PAGE_SIZE = 1000

async function fetchAllCompliance() {
  const rows = []
  for (let from = 0; ; from += PAGE_SIZE) {
    const to = from + PAGE_SIZE - 1
    const { data, error } = await supabase
      .from(TABLE)
      .select('*')
      .order('branch_code', { ascending: true })
      .range(from, to)
    if (error) throw error
    rows.push(...(data || []))
    if (!data || data.length < PAGE_SIZE) break
  }
  return rows
}

export function useComplianceCertificates() {
  return useQuery({
    queryKey: [TABLE],
    queryFn: fetchAllCompliance,
    staleTime: 30000,
  })
}

export function useCreateComplianceCertificate() {
  const qc = useQueryClient()
  const user = useAuthStore((s) => s.user)

  return useMutation({
    mutationFn: async (payload) => {
      const record = {
        ...payload,
        branch_code: String(payload.branch_code || '').trim().toUpperCase(),
        branch_name: String(payload.branch_name || '').normalize('NFC'),
        tin: String(payload.tin || '').normalize('NFC'),
        cor_address: String(payload.cor_address || '').normalize('NFC'),
        dole_address: String(payload.dole_address || '').normalize('NFC'),
        cams_address: String(payload.cams_address || '').normalize('NFC'),
        remarks: String(payload.remarks || '').normalize('NFC'),
        uploaded_by: user?.full_name || '',
      }
      const { error } = await supabase.from(TABLE).insert(record)
      if (error) throw error
      await logAudit({
        user,
        action: 'CREATE_COMPLIANCE_CERTIFICATE',
        module: 'Compliance',
        recordId: record.branch_code,
        after: record,
      })
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [TABLE] }),
  })
}

export function useUpdateComplianceCertificate() {
  const qc = useQueryClient()
  const user = useAuthStore((s) => s.user)

  return useMutation({
    mutationFn: async ({ id, updates }) => {
      const { data: before } = await supabase.from(TABLE).select('*').eq('id', id).maybeSingle()
      const next = {
        ...updates,
        branch_code: String(updates.branch_code || '').trim().toUpperCase(),
        branch_name: String(updates.branch_name || '').normalize('NFC'),
        tin: String(updates.tin || '').normalize('NFC'),
        cor_address: String(updates.cor_address || '').normalize('NFC'),
        dole_address: String(updates.dole_address || '').normalize('NFC'),
        cams_address: String(updates.cams_address || '').normalize('NFC'),
        remarks: String(updates.remarks || '').normalize('NFC'),
        updated_at: new Date().toISOString(),
      }
      const { error } = await supabase
        .from(TABLE)
        .update(next)
        .eq('id', id)
      if (error) throw error
      await logAudit({
        user,
        action: 'UPDATE_COMPLIANCE_CERTIFICATE',
        module: 'Compliance',
        recordId: next.branch_code || before?.branch_code,
        before,
        after: next,
      })
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [TABLE] }),
  })
}

export function useDeleteComplianceCertificate() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (record) => {
      const { error } = await supabase.from(TABLE).delete().eq('id', record.id)
      if (error) throw error
      await logAudit({
        user: useAuthStore.getState().user,
        action: 'DELETE_COMPLIANCE_CERTIFICATE',
        module: 'Compliance',
        recordId: record.branch_code,
        before: record,
      })
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [TABLE] }),
  })
}

export function useUpdateComplianceFile() {
  const qc = useQueryClient()
  const user = useAuthStore((s) => s.user)

  return useMutation({
    mutationFn: async ({ id, field, link }) => {
      const { data: before } = await supabase.from(TABLE).select('*').eq('id', id).maybeSingle()
      const { error } = await supabase
        .from(TABLE)
        .update({ [field]: link, updated_at: new Date().toISOString() })
        .eq('id', id)
      if (error) throw error
      await logAudit({
        user,
        action: field === 'cor_link' ? 'UPLOAD_COR_CERTIFICATE' : 'UPLOAD_DOLE_CERTIFICATE',
        module: 'Compliance',
        recordId: before?.branch_code || id,
        before,
        after: { [field]: link },
      })
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [TABLE] }),
  })
}
