import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import bcrypt from 'bcryptjs'
import { isSupabaseConfigured, supabase } from '../lib/supabase'

async function withHashedPassword(payload) {
  if (!payload?.password) return payload
  if (typeof payload.password === 'string' && payload.password.startsWith('$2')) return payload
  return {
    ...payload,
    password: await bcrypt.hash(payload.password.trim(), 10),
  }
}

export function useAccounts() {
  return useQuery({
    queryKey: ['accounts'],
    queryFn: async () => {
      const { data, error } = await supabase.from('accounts').select('id,username,role,full_name,email,photo_url,created_at').order('created_at', { ascending: false })
      if (error) throw error
      return data || []
    },
  })
}

export function useLogin() {
  return useMutation({
    mutationFn: async ({ username, password }) => {
      const loginId = username.trim()
      let { data, error } = await supabase
        .from('accounts')
        .select('*')
        .eq('username', loginId)
        .maybeSingle()

      if (!data && !error) {
        const byEmail = await supabase
          .from('accounts')
          .select('*')
          .eq('email', loginId)
          .maybeSingle()

        data = byEmail.data
        error = byEmail.error
      }

      if (error) {
        console.error('Supabase login error:', error)
        throw new Error(error.message || 'Invalid credentials')
      }
      if (!data) throw new Error('Invalid credentials')
      const storedPw = data.password;
      let isValid = false;
      if (typeof storedPw === 'string' && storedPw.startsWith('$2')) {
        isValid = await bcrypt.compare(password.trim(), storedPw);
      } else {
        // Allows existing plain-text accounts to keep working until their passwords are reset.
        isValid = storedPw === password.trim();
      }
      if (!isValid) throw new Error('Invalid credentials');
      // Remove password field before returning user data
      const { password: _, ...user } = data
      return user
    },
    // Optionally, onSuccess could set user store, but handled in Login component
  })
}


export function useCreateAccount() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload) => {
      const account = await withHashedPassword(payload)
      const { error } = await supabase.from('accounts').insert(account)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['accounts'] }),
  })
}

export function useUpdateAccount() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ username, updates }) => {
      const accountUpdates = await withHashedPassword(updates)
      const { error } = await supabase.from('accounts').update(accountUpdates).eq('username', username)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['accounts'] }),
  })
}

export function useDeleteAccount() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (username) => {
      const { error } = await supabase.from('accounts').delete().eq('username', username)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['accounts'] }),
  })
}

export function useSettings() {
  return useQuery({
    queryKey: ['settings'],
    enabled: isSupabaseConfigured,
    queryFn: async () => {
      const { data, error } = await supabase.from('system_settings').select('*')
      if (error) throw error
      const map = {}
      data.forEach((r) => { map[r.key] = r.value })
      return {
        maintenance: map.maintenance_mode === 'true',
        titles: JSON.parse(map.req_titles || '[]'),
      }
    },
  })
}

export function useUpdateSettings() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ maintenance, titles }) => {
      const updates = []
      if (maintenance !== undefined) {
        updates.push(supabase.from('system_settings').upsert({ key: 'maintenance_mode', value: String(maintenance) }))
      }
      if (titles) {
        updates.push(supabase.from('system_settings').upsert({ key: 'req_titles', value: JSON.stringify(titles) }))
      }
      await Promise.all(updates)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['settings'] }),
  })
}
