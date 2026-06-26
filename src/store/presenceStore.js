import { create } from 'zustand'

export const usePresenceStore = create((set) => ({
  onlineUsers: [],
  setOnlineUsers: (onlineUsers) => set({ onlineUsers }),
}))
