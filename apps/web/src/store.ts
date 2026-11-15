import { create } from 'zustand';
import type { GlobeStatus } from './globe/types';

export type DialogKind = 'privacy' | 'project' | 'accessible' | 'help';

interface InterfaceState {
  selectedPhase: number;
  activeDialog: DialogKind | null;
  autoRotate: boolean;
  countriesVisible: boolean;
  lighting: boolean;
  globeStatus: GlobeStatus;
  viewerKey: number;
  selectPhase: (phase: number) => void;
  setDialog: (dialog: DialogKind | null) => void;
  toggleRotation: () => void;
  stopRotation: () => void;
  toggleCountries: () => void;
  toggleLighting: () => void;
  setGlobeStatus: (status: GlobeStatus) => void;
  retryGlobe: () => void;
}

const initialStatus: GlobeStatus = {
  state: 'loading',
  countryCount: 0,
  terrain: 'ellipsoid',
  photorealistic: false,
};

export const useInterfaceStore = create<InterfaceState>((set) => ({
  selectedPhase: 1,
  activeDialog: null,
  autoRotate: true,
  countriesVisible: true,
  lighting: true,
  globeStatus: initialStatus,
  viewerKey: 0,
  selectPhase: (selectedPhase) => set({ selectedPhase }),
  setDialog: (activeDialog) => set({ activeDialog }),
  toggleRotation: () => set((state) => ({ autoRotate: !state.autoRotate })),
  stopRotation: () => set({ autoRotate: false }),
  toggleCountries: () =>
    set((state) => ({ countriesVisible: !state.countriesVisible })),
  toggleLighting: () => set((state) => ({ lighting: !state.lighting })),
  setGlobeStatus: (globeStatus) => set({ globeStatus }),
  retryGlobe: () =>
    set((state) => ({
      viewerKey: state.viewerKey + 1,
      globeStatus: initialStatus,
    })),
}));
