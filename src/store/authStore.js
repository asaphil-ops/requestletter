import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { ADMIN_ROLES, CAN_UPLOAD_ROLES } from '../lib/utils'

export const useAuthStore = create(
  persist(
    (set) => ({
      user: null,
      isAdmin: false,
      canUpload: false,
      canCheck: false,
      canApprove: false,

      setUser: (user) => set({
        user,
        isAdmin: ADMIN_ROLES.includes(user?.role),
        canUpload: CAN_UPLOAD_ROLES.includes(user?.role) || ADMIN_ROLES.includes(user?.role),
        canCheck: user?.role === 'Ops Finance' || ADMIN_ROLES.includes(user?.role),
        canApprove: user?.role === 'Finance' || ADMIN_ROLES.includes(user?.role),
      }),

      updatePhoto: (photoUrl) =>
        set((state) => ({ user: { ...state.user, photo_url: photoUrl } })),

      logout: () => set({ user: null, isAdmin: false, canUpload: false, canCheck: false, canApprove: false }),
    }),
    { name: 'ops-finance-auth' }
  )
)
