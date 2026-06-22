import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const useUIStore = create(
  persist(
    (set, get) => ({
      sidebarOpen: true,
      darkMode: false,
      notifications: [],

      toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
      setSidebar: (val) => set({ sidebarOpen: val }),

      toggleDarkMode: () => {
        const next = !get().darkMode
        set({ darkMode: next })
        document.documentElement.classList.toggle('dark', next)
      },
      initDarkMode: () => {
        const dm = get().darkMode
        document.documentElement.classList.toggle('dark', dm)
      },

      addNotification: (n) =>
        set((s) => ({ notifications: [{ ...n, id: Date.now() }, ...s.notifications].slice(0, 20) })),
      removeEntryNotifications: (table, data) =>
        set((s) => ({
          notifications: s.notifications.filter((n) => {
            const notificationKey = n.data?.req_id || n.data?.uniq_id || n.data?.id
            const rowKey = data?.req_id || data?.uniq_id || data?.id
            return !(n.table === table && rowKey && notificationKey === rowKey)
          }),
        })),
      clearNotifications: () => set({ notifications: [] }),

      // Toast notifications
      toasts: [],
      addToast: (n) =>
        set((s) => ({ toasts: [{ ...n, id: Date.now() + Math.random() }, ...s.toasts].slice(0, 5) })),
      removeToast: (id) => set((s) => ({ toasts: s.toasts.filter(t => t.id !== id) })),
    }),
    { name: 'ops-finance-ui', partialize: (s) => ({ darkMode: s.darkMode }) }
  )
)
