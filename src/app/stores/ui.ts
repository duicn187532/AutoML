import { create } from 'zustand';

export const MODULES = ['data', 'auto', 'library', 'dag', 'experiments', 'script'] as const;
export type ModuleId = (typeof MODULES)[number];

export interface LibraryPrefill {
  datasetId: string;
  target: string;
  pluginId: string;
  params: Record<string, number | string | boolean>;
}

interface UiState {
  module: ModuleId;
  datasetId: string | null;
  /** "Open in Model Library" hand-off from Auto mode / experiments. */
  libraryPrefill: LibraryPrefill | null;
  setLibraryPrefill(p: LibraryPrefill | null): void;
  setModule(m: ModuleId): void;
  selectDataset(id: string | null): void;
}

export const useUi = create<UiState>((set) => ({
  module: 'data',
  datasetId: null,
  libraryPrefill: null,
  setLibraryPrefill: (libraryPrefill) => set((s) => ({ libraryPrefill, datasetId: libraryPrefill?.datasetId ?? s.datasetId })),
  setModule: (module) => set({ module }),
  selectDataset: (datasetId) => set({ datasetId }),
}));
