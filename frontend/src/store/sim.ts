import { create } from 'zustand';

import { DEFAULT_REQUEST, simulate } from '@/engine';
import type { SimulateRequest, SimulateResponse } from '@/engine/types';

interface SimState {
  request: SimulateRequest;
  result: SimulateResponse | null;
  running: boolean;
  error: string | null;

  setRequest: (patch: Partial<SimulateRequest>) => void;
  setIntervention: (key: keyof SimulateRequest['interventions'], value: boolean) => void;
  run: () => Promise<void>;
}

export const useSimStore = create<SimState>((set, get) => ({
  request: DEFAULT_REQUEST,
  result: null,
  running: false,
  error: null,

  setRequest: (patch) => set((s) => ({ request: { ...s.request, ...patch } })),

  setIntervention: (key, value) =>
    set((s) => ({
      request: { ...s.request, interventions: { ...s.request.interventions, [key]: value } },
    })),

  run: async () => {
    set({ running: true, error: null });
    try {
      const result = await simulate(get().request);
      set({ result, running: false });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e), running: false });
    }
  },
}));
