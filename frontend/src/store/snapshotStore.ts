import { create } from 'zustand'
import type { DashboardSnapshot } from '../types'

interface SnapshotStore {
  snapshot: DashboardSnapshot | null
  lastUpdated: Date | null
  connected: boolean
  setSnapshot: (s: DashboardSnapshot) => void
  setConnected: (v: boolean) => void
}

export const useSnapshotStore = create<SnapshotStore>((set) => ({
  snapshot: null,
  lastUpdated: null,
  connected: false,
  setSnapshot: (snapshot) => set({ snapshot, lastUpdated: new Date(), connected: true }),
  setConnected: (connected) => set({ connected }),
}))
