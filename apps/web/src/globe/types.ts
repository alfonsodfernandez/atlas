export interface GlobeHandle {
  home: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
  tilt: () => void;
  goTo: (longitude: number, latitude: number, range?: number) => void;
  /** -1/1: left/right; -2/2: up/down. */
  rotate: (direction: number) => void;
}

export interface GlobeStatus {
  state: 'loading' | 'ready' | 'error';
  message?: string;
}

export interface GlobeProps {
  autoRotate: boolean;
  bordersVisible: boolean;
  demoVisible: boolean;
  reducedMotion: boolean;
  onInteraction: () => void;
  onStatus: (status: GlobeStatus) => void;
}
