import { useEffect, useMemo } from 'react'
import { useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'
import { usePresenceStore } from '../store/presenceStore'

const PAGE_LABELS = [
  ['/requests', 'Working on Request Letters'],
  ['/sbar', 'Working on SBAR / Transfer'],
  ['/it-expenses', 'Reviewing IT Expenses'],
  ['/at-expenses', 'Reviewing Aircon & Toilet'],
  ['/generator-expenses', 'Reviewing Generator Expenses'],
  ['/comms-expenses', 'Reviewing Comms Expenses'],
  ['/compliance/cor-dole', 'Checking COR and DOLE Certificates'],
  ['/cfoo-budget', 'Checking CFOO Budget'],
  ['/cost-center/initiatives', 'Working on Initiatives Cost Center'],
  ['/cost-center/cfoo', 'Working on CFOO Per Staff'],
  ['/cost-center/other', 'Working on Other Cost Center'],
  ['/data-management', 'Managing Data'],
  ['/employee-list', 'Viewing Employee List'],
  ['/send-email', 'Preparing Email'],
  ['/reports', 'Viewing Reports'],
  ['/directory', 'Viewing Directory'],
  ['/bulk-upload', 'Uploading Bulk Data'],
  ['/users', 'Managing Users'],
  ['/audit-logs', 'Checking Audit Trail'],
  ['/settings', 'Updating Settings'],
  ['/online-list', 'Viewing Online List'],
  ['/tracker', 'Viewing Request Tracker'],
]

function getActivity(pathname) {
  const match = PAGE_LABELS.find(([path]) => pathname.startsWith(path))
  return match?.[1] || 'Viewing Dashboard'
}

function userKey(user = {}) {
  return String(user.username || user.email || user.full_name || user.id || '').trim().toLowerCase()
}

function flattenPresence(state = {}) {
  const byUser = new Map()
  Object.values(state).flat().forEach((entry) => {
    const key = entry.user_key || userKey(entry)
    if (!key) return
    const current = byUser.get(key)
    if (!current || new Date(entry.last_seen_at || entry.online_since || 0) > new Date(current.last_seen_at || current.online_since || 0)) {
      byUser.set(key, entry)
    }
  })
  return [...byUser.values()].sort((a, b) => String(a.full_name || '').localeCompare(String(b.full_name || '')))
}

export default function usePresence() {
  const user = useAuthStore((state) => state.user)
  const setOnlineUsers = usePresenceStore((state) => state.setOnlineUsers)
  const location = useLocation()
  const activity = useMemo(() => getActivity(location.pathname), [location.pathname])

  useEffect(() => {
    if (!user) {
      setOnlineUsers([])
      return
    }

    const key = userKey(user)
    const sessionKey = `ops-presence-since-${key}`
    const onlineSince = sessionStorage.getItem(sessionKey) || new Date().toISOString()
    sessionStorage.setItem(sessionKey, onlineSince)

    const channel = supabase.channel('ops-online-users', {
      config: { presence: { key } },
    })

    const syncPresence = () => setOnlineUsers(flattenPresence(channel.presenceState()))

    channel
      .on('presence', { event: 'sync' }, syncPresence)
      .on('presence', { event: 'join' }, syncPresence)
      .on('presence', { event: 'leave' }, syncPresence)
      .subscribe(async (status) => {
        if (status !== 'SUBSCRIBED') return
        await channel.track({
          user_key: key,
          username: user.username || '',
          full_name: user.full_name || user.username || 'User',
          email: user.email || '',
          role: user.role || '',
          photo_url: user.photo_url || '',
          activity,
          path: location.pathname,
          online_since: onlineSince,
          last_seen_at: new Date().toISOString(),
        })
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user, activity, location.pathname, setOnlineUsers])
}
