import { create } from 'zustand';

export const MODULES = ['data', 'auto', 'library', 'dag', 'experiments', 'script'] as const;
export type ModuleId = (typeof MODULES)[number];

interface UiState {
  module: ModuleId;
  datasetId: string | null;
  setModule(m: ModuleId): void;
  selectDataset(id: string | null): void;
}

export const useUi = create<UiState>((set) => ({
  module: 'data',
  datasetId: null,
  setModule: (module) => set({ module }),
  selectDataset: (datasetId) => set({ datasetId }),
}));
