import { create } from 'zustand';

interface UiState {
  autoRotate: boolean;
  stopAutoRotate: () => void;
  startAutoRotate: () => void;

  /** Company id under the cursor, shared by every view so selection stays linked. */
  hoveredId: string | null;
  setHovered: (id: string | null) => void;

  /** Company id currently opened in the dossier. */
  selectedId: string | null;
  select: (id: string | null) => void;

  /** Month shown by the timeline scrubber. */
  month: number;
  setMonth: (m: number) => void;

  /**
   * Dims every entity with direct hazard exposure, leaving only those whose risk
   * arrives entirely through dependencies. This is the FIN-04 argument in one toggle.
   */
  hiddenOnly: boolean;
  toggleHiddenOnly: () => void;

  evidenceOpen: boolean;
  toggleEvidence: () => void;

  /**
   * Propagation playhead, 0 to 1. Drives the arc reveal and the marker arrival
   * pulses. Advanced by the scene's frame loop, not by a timer, so it stays in step
   * with rendering.
   */
  playhead: number;
  playing: boolean;
  setPlayhead: (p: number) => void;
  play: () => void;
  stop: () => void;
}

export const useUiStore = create<UiState>((set) => ({
  autoRotate: true,
  stopAutoRotate: () => set({ autoRotate: false }),
  startAutoRotate: () => set({ autoRotate: true }),

  hoveredId: null,
  setHovered: (hoveredId) => set({ hoveredId }),

  selectedId: null,
  select: (selectedId) => set({ selectedId }),

  month: 1,
  setMonth: (month) => set({ month }),

  hiddenOnly: false,
  toggleHiddenOnly: () => set((s) => ({ hiddenOnly: !s.hiddenOnly })),

  evidenceOpen: false,
  toggleEvidence: () => set((s) => ({ evidenceOpen: !s.evidenceOpen })),

  playhead: 1,
  playing: false,
  setPlayhead: (playhead) => set({ playhead }),
  play: () => set({ playhead: 0, playing: true, autoRotate: false }),
  stop: () => set({ playing: false }),
}));
