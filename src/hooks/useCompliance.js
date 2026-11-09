import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { logAudit } from '../lib/audit'
import { useAuthStore } from '../store/authStore'

const TABLE = 'compliance_certificates'
const PAGE_SIZE = 1000
export const DOLE_MODULE_TAG = '__MODULE_DOLE__'
export const TRANSMITTAL_MODULE_TAG = '__MODULE_TRANSMITTAL__'
export const PHOTOCOPY_COR_TAG = '__PHOTOCOPY_COR__'
const TRANSMITTAL_CODE_PREFIX = 'TRN::'

export function isDoleRecord(row) {
  return String(row?.cor_link || '').trim() === DOLE_MODULE_TAG
}

export function isTransmittalRecord(row) {
  return (
    String(row?.dole_link || '').trim() === TRANSMITTAL_MODULE_TAG ||
    String(row?.branch_code || '').trim().toUpperCase().startsWith(TRANSMITTAL_CODE_PREFIX)
  )
}

export function isPhotocopyCorRecord(row) {
  if (!row || isDoleRecord(row) || isTransmittalRecord(row)) return false
  if (String(row?.dole_address || '').trim() === PHOTOCOPY_COR_TAG) return true
  const remarks = String(row?.remarks || '').trim()
  return /\b(photocopy|photo\s*copy|w\/o\s*orig|without\s*orig|no\s*orig|copy\s*only|w\/o\s*original)\b/i.test(
    remarks
  )
}

export function cleanTransmittalBranchCode(rawCode) {
  return String(rawCode || '')
    .trim()
    .toUpperCase()
    .replace(/^TRN::/i, '')
    .replace(/::.*$/, '')
    .trim()
}

export function toTransmittalDbBranchCode(branchCode) {
  const clean = cleanTransmittalBranchCode(branchCode).replace(/O/g, '0')
  return `${TRANSMITTAL_CODE_PREFIX}${clean}`
}

export function packTransmittalMeta(payload = {}) {
  return JSON.stringify({
    type_of_application: String(payload.type_of_application || '').normalize('NFC').trim(),
    date_received_lbc: String(payload.date_received_lbc || '').trim(),
    date_submitted_bir: String(payload.date_submitted_bir || '').trim(),
    remarks_in_charge: String(payload.remarks_in_charge || '').normalize('NFC').trim(),
    remarks_bir: String(payload.remarks_bir || '').normalize('NFC').trim(),
    claimed_from_bir: String(payload.claimed_from_bir || '').normalize('NFC').trim(),
  })
}

export function unpackTransmittalRow(row) {
  if (!row) return null
  let meta = {}
  if (row.dole_address) {
    try {
      meta = JSON.parse(row.dole_address) || {}
    } catch {
      meta = {}
    }
  }
  return {
    ...row,
    db_branch_code: row.branch_code,
    branch_code: cleanTransmittalBranchCode(row.branch_code),
    branch_name: String(row.branch_name || '').trim(),
    type_of_application: String(meta.type_of_application ?? row.type_of_application ?? '').trim(),
    date_received_lbc: String(meta.date_received_lbc ?? row.date_received_lbc ?? '').trim(),
    date_submitted_bir: String(meta.date_submitted_bir ?? row.date_submitted_bir ?? '').trim(),
    remarks_in_charge: String(meta.remarks_in_charge ?? row.remarks_in_charge ?? '').trim(),
    remarks_bir: String(meta.remarks_bir ?? row.remarks_bir ?? row.remarks ?? '').trim(),
    claimed_from_bir: String(meta.claimed_from_bir ?? row.claimed_from_bir ?? '').trim(),
    cor_link: String(row.cor_link || '').trim(),
  }
}

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

export function useComplianceCertificates(certType = 'cor') {
  return useQuery({
    queryKey: [TABLE, certType],
    queryFn: async () => {
      const all = await fetchAllCompliance()
      const nonTransmittal = all.filter((row) => !isTransmittalRecord(row))
      if (certType === 'dole') {
        return nonTransmittal.filter(isDoleRecord)
      }
      return nonTransmittal.filter((row) => !isDoleRecord(row))
    },
    staleTime: 30000,
  })
}

export function useCreateComplianceCertificate(certType = 'cor') {
  const qc = useQueryClient()
  const user = useAuthStore((s) => s.user)

  return useMutation({
    mutationFn: async (payload) => {
      const isDole = certType === 'dole'
      const record = {
        ...payload,
        branch_code: String(payload.branch_code || '').trim().toUpperCase(),
        branch_name: String(payload.branch_name || '').normalize('NFC'),
        tin: String(payload.tin || '').normalize('NFC'),
        cor_address: isDole ? '' : String(payload.cor_address || '').normalize('NFC'),
        cor_link: isDole ? DOLE_MODULE_TAG : String(payload.cor_link || '').trim(),
        dole_address: isDole
          ? String(payload.dole_address || '').normalize('NFC')
          : payload.dole_address === PHOTOCOPY_COR_TAG
            ? PHOTOCOPY_COR_TAG
            : '',
        dole_link: isDole ? String(payload.dole_link || '').trim() : '',
        cams_address: String(payload.cams_address || '').normalize('NFC'),
        remarks: String(payload.remarks || '').normalize('NFC'),
        uploaded_by: user?.full_name || '',
      }
      const { error } = await supabase.from(TABLE).insert(record)
      if (error) throw error
      await logAudit({
        user,
        action: isDole ? 'CREATE_DOLE_CERTIFICATE' : 'CREATE_COR_CERTIFICATE',
        module: isDole ? 'DOLE Certification' : 'COR Certification',
        recordId: record.branch_code,
        after: record,
      })
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [TABLE] }),
  })
}

export function useUpdateComplianceCertificate(certType = 'cor') {
  const qc = useQueryClient()
  const user = useAuthStore((s) => s.user)

  return useMutation({
    mutationFn: async ({ id, updates }) => {
      const isDole = certType === 'dole'
      const { data: before } = await supabase.from(TABLE).select('*').eq('id', id).maybeSingle()
      const next = {
        ...updates,
        branch_code: String(updates.branch_code || '').trim().toUpperCase(),
        branch_name: String(updates.branch_name || '').normalize('NFC'),
        tin: String(updates.tin || '').normalize('NFC'),
        cor_address: isDole ? '' : String(updates.cor_address || '').normalize('NFC'),
        cor_link: isDole ? DOLE_MODULE_TAG : String(updates.cor_link || '').trim(),
        dole_address: isDole
          ? String(updates.dole_address || '').normalize('NFC')
          : updates.dole_address === PHOTOCOPY_COR_TAG
            ? PHOTOCOPY_COR_TAG
            : '',
        dole_link: isDole ? String(updates.dole_link || '').trim() : '',
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
        action: isDole ? 'UPDATE_DOLE_CERTIFICATE' : 'UPDATE_COR_CERTIFICATE',
        module: isDole ? 'DOLE Certification' : 'COR Certification',
        recordId: next.branch_code || before?.branch_code,
        before,
        after: next,
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [TABLE] })
      qc.invalidateQueries({ queryKey: ['compliance_history'] })
      qc.invalidateQueries({ queryKey: ['timeline'] })
    },
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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [TABLE] })
      qc.invalidateQueries({ queryKey: ['compliance_history'] })
    },
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
        module: field === 'dole_link' ? 'DOLE Certification' : 'COR Certification',
        recordId: before?.branch_code || id,
        before,
        after: { ...(before || {}), [field]: link },
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [TABLE] })
      qc.invalidateQueries({ queryKey: ['compliance_history'] })
      qc.invalidateQueries({ queryKey: ['timeline'] })
    },
  })
}

export function useComplianceHistory(branchCode, certType = 'cor') {
  const code = String(branchCode || '').trim().toUpperCase()
  const isDole = certType === 'dole'
  const addressField = isDole ? 'dole_address' : 'cor_address'
  const linkField = isDole ? 'dole_link' : 'cor_link'

  return useQuery({
    queryKey: ['compliance_history', code, certType],
    enabled: Boolean(code),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('audit_logs')
        .select('*')
        .ilike('details', `%"recordId":"${code}"%`)
        .order('created_at', { ascending: false })
        .limit(50)

      if (error) throw error

      const cleanLink = (val) => {
        const str = String(val || '').trim()
        return str === DOLE_MODULE_TAG ? '' : str
      }

      const previousVersions = []
      ;(data || []).forEach((log) => {
        let parsed = null
        try {
          parsed = JSON.parse(log.details)
        } catch {
          return
        }
        if (!parsed || String(parsed.recordId || '').toUpperCase() !== code) return
        if (!parsed.before || !parsed.after) return

        // Filter out logs meant for the other certification module
        const logIsDole =
          log.action?.includes('DOLE') ||
          parsed.module === 'DOLE Certification' ||
          isDoleRecord(parsed.before) ||
          isDoleRecord(parsed.after)
        if (isDole !== Boolean(logIsDole)) return

        const beforeAddr = String(parsed.before?.[addressField] || '').trim()
        const afterAddr = String(parsed.after?.[addressField] || '').trim()
        const beforeLink = cleanLink(parsed.before?.[linkField])
        const afterLink = cleanLink(parsed.after?.[linkField])

        const addrChanged = beforeAddr !== afterAddr
        const linkChanged = beforeLink !== afterLink

        // Archive whenever an existing address or certificate file was replaced/updated
        if ((addrChanged && beforeAddr) || (linkChanged && beforeLink)) {
          previousVersions.push({
            id: log.id,
            changedAt: log.created_at,
            changedBy: log.user_name || 'Staff',
            action: log.action,
            previousAddress: beforeAddr,
            newAddress: afterAddr,
            previousLink: beforeLink,
            newLink: afterLink,
            addrChanged,
            linkChanged,
            previousTin: String(parsed.before?.tin || '').trim(),
            previousRemarks: String(parsed.before?.remarks || '').trim(),
            newRemarks: String(parsed.after?.remarks || '').trim(),
          })
        }
      })

      return previousVersions
    },
    staleTime: 15000,
  })
}

export function useBulkImportComplianceCertificates(certType = 'cor') {
  const qc = useQueryClient()
  const user = useAuthStore((s) => s.user)

  return useMutation({
    mutationFn: async ({ rows = [], mode = 'upsert' }) => {
      if (!rows.length) return { inserted: 0, updated: 0 }

      const isDole = certType === 'dole'
      const now = new Date().toISOString()
      const cleaned = rows.map((r) => ({
        branch_code: String(r.branch_code || '').trim().toUpperCase().replace(/O/g, '0'),
        branch_name: String(r.branch_name || '').normalize('NFC').trim(),
        branch_type: String(r.branch_type || '').normalize('NFC').trim(),
        tin: String(r.tin || '').normalize('NFC').trim(),
        cor_address: isDole ? '' : String(r.cor_address || '').normalize('NFC').trim(),
        cor_link: isDole ? DOLE_MODULE_TAG : String(r.cor_link || '').trim(),
        dole_address: isDole
          ? String(r.dole_address || '').normalize('NFC').trim()
          : r.dole_address === PHOTOCOPY_COR_TAG
            ? PHOTOCOPY_COR_TAG
            : '',
        dole_link: isDole ? String(r.dole_link || '').trim() : '',
        cams_address: String(r.cams_address || '').normalize('NFC').trim(),
        remarks: String(r.remarks || '').normalize('NFC').trim(),
        uploaded_by: user?.full_name || '',
        updated_at: now,
      }))

      let inserted = 0
      let updated = 0

      if (mode === 'insert') {
        for (let i = 0; i < cleaned.length; i += 200) {
          const chunk = cleaned.slice(i, i + 200)
          const { error } = await supabase.from(TABLE).insert(chunk)
          if (error) throw error
          inserted += chunk.length
        }
      } else {
        const allExisting = await fetchAllCompliance()
        const nonTransmittal = allExisting.filter((item) => !isTransmittalRecord(item))
        const existingRows = isDole
          ? nonTransmittal.filter(isDoleRecord)
          : nonTransmittal.filter((item) => !isDoleRecord(item))

        const existingMap = new Map()
        existingRows.forEach((item) => {
          const code = String(item.branch_code || '').trim().toUpperCase()
          if (code && !existingMap.has(code)) {
            existingMap.set(code, item)
          }
        })

        const toInsert = []
        const toUpdate = []

        cleaned.forEach((row) => {
          const existing = existingMap.get(row.branch_code)
          if (existing) {
            toUpdate.push({
              id: existing.id,
              updates: {
                branch_code: row.branch_code,
                branch_name: row.branch_name || existing.branch_name || '',
                branch_type: row.branch_type || existing.branch_type || '',
                tin: row.tin || existing.tin || '',
                cor_address: isDole ? '' : (row.cor_address || existing.cor_address || ''),
                cor_link: isDole ? DOLE_MODULE_TAG : (row.cor_link || existing.cor_link || ''),
                dole_address: isDole
                  ? (row.dole_address || existing.dole_address || '')
                  : (row.dole_address === PHOTOCOPY_COR_TAG || existing.dole_address === PHOTOCOPY_COR_TAG
                      ? PHOTOCOPY_COR_TAG
                      : ''),
                dole_link: isDole ? (row.dole_link || existing.dole_link || '') : '',
                cams_address: row.cams_address || existing.cams_address || '',
                remarks: row.remarks || existing.remarks || '',
                updated_at: now,
              },
            })
          } else {
            toInsert.push(row)
          }
        })

        for (let i = 0; i < toInsert.length; i += 200) {
          const chunk = toInsert.slice(i, i + 200)
          const { error } = await supabase.from(TABLE).insert(chunk)
          if (error) throw error
          inserted += chunk.length
        }

        for (const item of toUpdate) {
          const { error } = await supabase.from(TABLE).update(item.updates).eq('id', item.id)
          if (error) throw error
          updated += 1
        }
      }

      await logAudit({
        user,
        action: isDole ? 'BULK_IMPORT_DOLE_CERTIFICATES' : 'BULK_IMPORT_COR_CERTIFICATES',
        module: isDole ? 'DOLE Certification' : 'COR Certification',
        recordId: `${inserted + updated} records`,
        after: { mode, inserted, updated, total: cleaned.length },
      })

      return { inserted, updated }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [TABLE] }),
  })
}

// ============================================================
// COMPLIANCE - TRANSMITTAL HOOKS
// ============================================================

export function useTransmittals() {
  return useQuery({
    queryKey: [TABLE, 'transmittal'],
    queryFn: async () => {
      const all = await fetchAllCompliance()
      return all
        .filter(isTransmittalRecord)
        .map(unpackTransmittalRow)
        .sort((a, b) => String(a.branch_code || '').localeCompare(String(b.branch_code || '')))
    },
    staleTime: 30000,
  })
}

export function useCreateTransmittal() {
  const qc = useQueryClient()
  const user = useAuthStore((s) => s.user)

  return useMutation({
    mutationFn: async (payload) => {
      const cleanCode = cleanTransmittalBranchCode(payload.branch_code).replace(/O/g, '0')
      const dbBranchCode = toTransmittalDbBranchCode(cleanCode)
      const record = {
        branch_code: dbBranchCode,
        branch_name: String(payload.branch_name || '').normalize('NFC').trim(),
        tin: '',
        cor_address: '',
        cor_link: String(payload.cor_link || '').trim(),
        dole_address: packTransmittalMeta(payload),
        dole_link: TRANSMITTAL_MODULE_TAG,
        cams_address: '',
        remarks: String(payload.remarks_bir || payload.remarks_in_charge || '').normalize('NFC').trim(),
        uploaded_by: user?.full_name || '',
      }
      const { error } = await supabase.from(TABLE).insert(record)
      if (error) throw error
      await logAudit({
        user,
        action: 'CREATE_TRANSMITTAL',
        module: 'Transmittal',
        recordId: cleanCode,
        after: unpackTransmittalRow(record),
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [TABLE] })
      qc.invalidateQueries({ queryKey: ['timeline'] })
    },
  })
}

export function useUpdateTransmittal() {
  const qc = useQueryClient()
  const user = useAuthStore((s) => s.user)

  return useMutation({
    mutationFn: async ({ id, updates }) => {
      const { data: beforeRaw } = await supabase.from(TABLE).select('*').eq('id', id).maybeSingle()
      const cleanCode = cleanTransmittalBranchCode(updates.branch_code || beforeRaw?.branch_code).replace(/O/g, '0')
      const dbBranchCode = toTransmittalDbBranchCode(cleanCode)
      const next = {
        branch_code: dbBranchCode,
        branch_name: String(updates.branch_name || '').normalize('NFC').trim(),
        cor_link: String(updates.cor_link || '').trim(),
        dole_address: packTransmittalMeta(updates),
        dole_link: TRANSMITTAL_MODULE_TAG,
        remarks: String(updates.remarks_bir || updates.remarks_in_charge || '').normalize('NFC').trim(),
        updated_at: new Date().toISOString(),
      }
      const { error } = await supabase.from(TABLE).update(next).eq('id', id)
      if (error) throw error
      await logAudit({
        user,
        action: 'UPDATE_TRANSMITTAL',
        module: 'Transmittal',
        recordId: cleanCode,
        before: beforeRaw ? unpackTransmittalRow(beforeRaw) : null,
        after: unpackTransmittalRow({ ...(beforeRaw || {}), ...next }),
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [TABLE] })
      qc.invalidateQueries({ queryKey: ['compliance_history'] })
      qc.invalidateQueries({ queryKey: ['timeline'] })
    },
  })
}

export function useDeleteTransmittal() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (record) => {
      const { error } = await supabase.from(TABLE).delete().eq('id', record.id)
      if (error) throw error
      await logAudit({
        user: useAuthStore.getState().user,
        action: 'DELETE_TRANSMITTAL',
        module: 'Transmittal',
        recordId: cleanTransmittalBranchCode(record.branch_code),
        before: record,
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [TABLE] })
      qc.invalidateQueries({ queryKey: ['timeline'] })
    },
  })
}

export function useUpdateTransmittalFile() {
  const qc = useQueryClient()
  const user = useAuthStore((s) => s.user)

  return useMutation({
    mutationFn: async ({ id, link }) => {
      const { data: beforeRaw } = await supabase.from(TABLE).select('*').eq('id', id).maybeSingle()
      const { error } = await supabase
        .from(TABLE)
        .update({ cor_link: link, updated_at: new Date().toISOString() })
        .eq('id', id)
      if (error) throw error
      const cleanCode = cleanTransmittalBranchCode(beforeRaw?.branch_code || id)
      await logAudit({
        user,
        action: 'UPLOAD_TRANSMITTAL_COR',
        module: 'Transmittal',
        recordId: cleanCode,
        before: beforeRaw ? unpackTransmittalRow(beforeRaw) : null,
        after: unpackTransmittalRow({ ...(beforeRaw || {}), cor_link: link }),
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [TABLE] })
      qc.invalidateQueries({ queryKey: ['timeline'] })
    },
  })
}

export function useBulkImportTransmittals() {
  const qc = useQueryClient()
  const user = useAuthStore((s) => s.user)

  return useMutation({
    mutationFn: async ({ rows = [], mode = 'upsert' }) => {
      if (!rows.length) return { inserted: 0, updated: 0 }

      const now = new Date().toISOString()
      const cleaned = rows.map((r) => {
        const cleanCode = cleanTransmittalBranchCode(r.branch_code).replace(/O/g, '0')
        return {
          cleanCode,
          branch_code: toTransmittalDbBranchCode(cleanCode),
          branch_name: String(r.branch_name || '').normalize('NFC').trim(),
          tin: '',
          cor_address: '',
          cor_link: String(r.cor_link || '').trim(),
          dole_address: packTransmittalMeta(r),
          dole_link: TRANSMITTAL_MODULE_TAG,
          cams_address: '',
          remarks: String(r.remarks_bir || r.remarks_in_charge || '').normalize('NFC').trim(),
          uploaded_by: user?.full_name || '',
          updated_at: now,
          rawMeta: r,
        }
      })

      let inserted = 0
      let updated = 0

      const stripHelperFields = ({ cleanCode: _c, rawMeta: _m, ...dbRow }) => dbRow

      if (mode === 'insert') {
        for (let i = 0; i < cleaned.length; i += 200) {
          const chunk = cleaned.slice(i, i + 200).map(stripHelperFields)
          const { error } = await supabase.from(TABLE).insert(chunk)
          if (error) throw error
          inserted += chunk.length
        }
      } else {
        const allExisting = await fetchAllCompliance()
        const existingTransmittals = allExisting.filter(isTransmittalRecord).map(unpackTransmittalRow)

        const existingMap = new Map()
        existingTransmittals.forEach((item) => {
          const code = cleanTransmittalBranchCode(item.branch_code)
          if (code && !existingMap.has(code)) {
            existingMap.set(code, item)
          }
        })

        const toInsert = []
        const toUpdate = []

        cleaned.forEach((row) => {
          const existing = existingMap.get(row.cleanCode)
          if (existing) {
            const mergedMeta = {
              type_of_application: row.rawMeta.type_of_application || existing.type_of_application || '',
              date_received_lbc: row.rawMeta.date_received_lbc || existing.date_received_lbc || '',
              date_submitted_bir: row.rawMeta.date_submitted_bir || existing.date_submitted_bir || '',
              remarks_in_charge: row.rawMeta.remarks_in_charge || existing.remarks_in_charge || '',
              remarks_bir: row.rawMeta.remarks_bir || existing.remarks_bir || '',
              claimed_from_bir: row.rawMeta.claimed_from_bir || existing.claimed_from_bir || '',
            }
            toUpdate.push({
              id: existing.id,
              updates: {
                branch_code: row.branch_code,
                branch_name: row.branch_name || existing.branch_name || '',
                cor_link: row.cor_link || existing.cor_link || '',
                dole_address: packTransmittalMeta(mergedMeta),
                dole_link: TRANSMITTAL_MODULE_TAG,
                remarks: String(mergedMeta.remarks_bir || mergedMeta.remarks_in_charge || '').normalize('NFC').trim(),
                updated_at: now,
              },
            })
          } else {
            toInsert.push(stripHelperFields(row))
          }
        })

        for (let i = 0; i < toInsert.length; i += 200) {
          const chunk = toInsert.slice(i, i + 200)
          const { error } = await supabase.from(TABLE).insert(chunk)
          if (error) throw error
          inserted += chunk.length
        }

        for (const item of toUpdate) {
          const { error } = await supabase.from(TABLE).update(item.updates).eq('id', item.id)
          if (error) throw error
          updated += 1
        }
      }

      await logAudit({
        user,
        action: 'BULK_IMPORT_TRANSMITTALS',
        module: 'Transmittal',
        recordId: `${inserted + updated} records`,
        after: { mode, inserted, updated, total: cleaned.length },
      })

      return { inserted, updated }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [TABLE] }),
  })
}
