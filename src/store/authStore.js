import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { permissionsForRole } from '../lib/permissions'

export const useAuthStore = create(
  persist(
    (set) => ({
      user: null,
      isAdmin: false,
      canUpload: false,
      canCheck: false,
      canApprove: false,
      canViewReports: false,
      canExportReports: false,

      setUser: (user) => set({ user, ...permissionsForRole(user?.role) }),

      updatePhoto: (photoUrl) =>
        set((state) => ({ user: { ...state.user, photo_url: photoUrl } })),

      logout: () => set({ user: null, isAdmin: false, canUpload: false, canCheck: false, canApprove: false, canViewReports: false, canExportReports: false }),
    }),
    { name: 'ops-finance-auth' }
  )
)
