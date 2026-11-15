import { create } from 'zustand';

interface InterfaceState {
  selectedPhase: number;
  privacyOpen: boolean;
  selectPhase: (phase: number) => void;
  setPrivacyOpen: (open: boolean) => void;
}

export const useInterfaceStore = create<InterfaceState>((set) => ({
  selectedPhase: 1,
  privacyOpen: false,
  selectPhase: (selectedPhase) => set({ selectedPhase }),
  setPrivacyOpen: (privacyOpen) => set({ privacyOpen }),
}));
