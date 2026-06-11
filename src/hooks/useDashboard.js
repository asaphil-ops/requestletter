import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

export function useDashboard() {
  return useQuery({
    queryKey: ['dashboard'],
    queryFn: async () => {
      const [staff, requests, sbar, it, at, comms, emailLogs] = await Promise.all([
        supabase.from('staff').select('id', { count: 'exact', head: true }),
        supabase.from('requests').select('id,status,amount,title,date_req,created_at,uploader'),
        supabase.from('sbar').select('id,status,amount,date,created_at,giver,receiver'),
        supabase.from('it_expenses').select('id,status,amount,category,date,branch_code,created_at'),
        supabase.from('at_expenses').select('id,status,amount,category,date,branch_code,created_at'),
        supabase.from('comms_expenses').select('id,status,amount,category,date,branch_code,created_at'),
        supabase.from('email_logs').select('id,created_at', { count: 'exact', head: true }),
      ])

      const allReqs = requests.data || []
      const allSbar = sbar.data || []
      const allIT   = it.data   || []
      const allAT   = at.data   || []
      const allComms = comms.data || []

      const combined = [
        ...allReqs.map(r => ({ ...r, _type: 'req', date: r.date_req })),
        ...allSbar.map(r => ({ ...r, _type: 'sbar' })),
        ...allIT.map(r   => ({ ...r, _type: 'it'   })),
        ...allAT.map(r   => ({ ...r, _type: 'at'   })),
        ...allComms.map(r => ({ ...r, _type: 'comms' })),
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
      }
    },
    staleTime: 60000,
  })
}
