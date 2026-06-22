import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

export const PENDING_COUNT_TABLES = {
  req: 'requests',
  sbar: 'sbar',
  it: 'it_expenses',
  at: 'at_expenses',
  comms: 'comms_expenses',
  initiatives: 'cost_center_initiatives',
  cfoo: 'cost_center_cfoo',
  otherCostCenter: 'cost_center_other',
}

export function usePendingCounts() {
  return useQuery({
    queryKey: ['pending-counts'],
    queryFn: async () => {
      const entries = await Promise.all(
        Object.entries(PENDING_COUNT_TABLES).map(async ([key, table]) => {
          const { count, error } = await supabase
            .from(table)
            .select('id', { count: 'exact', head: true })
            .or('status.eq.Pending,status.is.null')

          if (error) throw error
          return [key, count || 0]
        })
      )

      return Object.fromEntries(entries)
    },
    staleTime: 15000,
  })
}

export function useDashboard() {
  return useQuery({
    queryKey: ['dashboard'],
    queryFn: async () => {
      const [staff, requests, sbar, it, at, comms, initiatives, cfoo, otherCostCenter, emailLogs] = await Promise.all([
        supabase.from('staff').select('id', { count: 'exact', head: true }),
        supabase.from('requests').select('id,status,amount,title,date_req,created_at,uploader,beneficiary'),
        supabase.from('sbar').select('id,status,amount,date,created_at,giver,receiver'),
        supabase.from('it_expenses').select('id,status,amount,category,date,branch_code,created_at'),
        supabase.from('at_expenses').select('id,status,amount,category,date,branch_code,created_at'),
        supabase.from('comms_expenses').select('id,status,amount,category,date,branch_code,created_at'),
        supabase.from('cost_center_initiatives').select('id,status,amount,date,created_at'),
        supabase.from('cost_center_cfoo').select('id,status,amount,date,created_at'),
        supabase.from('cost_center_other').select('id,status,amount,date,created_at'),
        supabase.from('email_logs').select('id,created_at', { count: 'exact', head: true }),
      ])

      const allReqs = requests.data || []
      const allSbar = sbar.data || []
      const allIT   = it.data   || []
      const allAT   = at.data   || []
      const allComms = comms.data || []
      const allInitiatives = initiatives.data || []
      const allCfoo = cfoo.data || []
      const allOtherCostCenter = otherCostCenter.data || []

      const combined = [
        ...allReqs.map(r => ({ ...r, _type: 'req', date: r.date_req })),
        ...allSbar.map(r => ({ ...r, _type: 'sbar' })),
        ...allIT.map(r   => ({ ...r, _type: 'it'   })),
        ...allAT.map(r   => ({ ...r, _type: 'at'   })),
        ...allComms.map(r => ({ ...r, _type: 'comms' })),
        ...allInitiatives.map(r => ({ ...r, _type: 'initiatives' })),
        ...allCfoo.map(r => ({ ...r, _type: 'cfoo' })),
        ...allOtherCostCenter.map(r => ({ ...r, _type: 'otherCostCenter' })),
      ]

      const statusCount = (arr, s) => arr.filter(r => r.status === s).length

      return {
        totalStaff:  staff.count || 0,
        emailsSent:  emailLogs.count || 0,
        totalReqs:   combined.length,
        pending:  statusCount(combined, 'Pending'),
        approved: statusCount(combined, 'Approved'),
        rejected: statusCount(combined, 'Rejected'),
        checked:  statusCount(combined, 'Checked'),
        combined,
        allReqs,
        allSbar,
        allIT,
        allAT,
        allComms,
        allInitiatives,
        allCfoo,
        allOtherCostCenter,
      }
    },
    staleTime: 60000,
  })
}
