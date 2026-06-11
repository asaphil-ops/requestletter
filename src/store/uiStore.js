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
      clearNotifications: () => set({ notifications: [] }),
    }),
    { name: 'ops-finance-ui', partialize: (s) => ({ darkMode: s.darkMode }) }
  )
)
