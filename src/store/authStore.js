import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { permissionsForRole } from '../lib/permissions'

const authStorage = {
  getItem: (name) => window.sessionStorage.getItem(name) ?? window.localStorage.getItem(name),
  setItem: (name, value) => {
    const rememberLogin = JSON.parse(value)?.state?.rememberMe === true
    const destination = rememberLogin ? window.localStorage : window.sessionStorage
    const other = rememberLogin ? window.sessionStorage : window.localStorage
    other.removeItem(name)
    destination.setItem(name, value)
  },
  removeItem: (name) => {
    window.localStorage.removeItem(name)
    window.sessionStorage.removeItem(name)
  },
}

export const useAuthStore = create(
  persist(
    (set) => ({
      user: null,
      rememberMe: false,
      isAdmin: false,
      isSuperAdmin: false,
      canUpload: false,
      canCheck: false,
      canApprove: false,
      canViewReports: false,
      canExportReports: false,
      canManageUsers: false,
      canManageSettings: false,
      canManageEmployees: false,
      canManageData: false,
      canForceDelete: false,

      setUser: (user) => set({ user, ...permissionsForRole(user?.role) }),
      setRememberMe: (rememberMe) => set({ rememberMe }),

      updatePhoto: (photoUrl) =>
        set((state) => ({ user: { ...state.user, photo_url: photoUrl } })),

      logout: () => set({ user: null, isAdmin: false, isSuperAdmin: false, canUpload: false, canCheck: false, canApprove: false, canViewReports: false, canExportReports: false, canManageUsers: false, canManageSettings: false, canManageEmployees: false, canManageData: false, canForceDelete: false }),
    }),
    { name: 'ops-finance-auth', storage: createJSONStorage(() => authStorage) }
  )
)
