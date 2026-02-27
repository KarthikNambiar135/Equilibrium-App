import { create } from 'zustand'
import type { Profile, Group, GroupWithMembers } from '@/lib/types/database'

interface AppState {
  // User
  user: Profile | null
  setUser: (user: Profile | null) => void

  // Groups
  groups: Group[]
  setGroups: (groups: Group[]) => void
  activeGroup: GroupWithMembers | null
  setActiveGroup: (group: GroupWithMembers | null) => void

  // UI State
  isLoading: boolean
  setIsLoading: (loading: boolean) => void
}

export const useAppStore = create<AppState>((set) => ({
  user: null,
  setUser: (user) => set({ user }),

  groups: [],
  setGroups: (groups) => set({ groups }),
  activeGroup: null,
  setActiveGroup: (group) => set({ activeGroup: group }),

  isLoading: false,
  setIsLoading: (isLoading) => set({ isLoading }),
}))
