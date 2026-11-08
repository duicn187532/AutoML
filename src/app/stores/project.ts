import { create } from 'zustand';
import { contentHash, decodeTable, encodeTable } from '@/core/data/codec';
import { profileColumn, type ColumnarTable } from '@/core/data/table';
import {
  datasetBlobKey,
  emptyProject,
  type DatasetRecord,
  type ExperimentRecord,
  type ModelRecord,
  type PipelineRecord,
  type ScriptRecord,
  type GraphRecord,
  type Project,
} from '@/core/project/types';
import { freshSeed } from '@/core/rng';
import { exportProjectZip, importProjectZip } from '@/core/storage/zip';
import { newId } from '@/core/util/id';
import { translate, useLocale } from '@/i18n';
import { APP_VERSION, storage } from '../services';

const LAST_PROJECT = 'lastProjectId';
const tableCache = new Map<string, ColumnarTable>();

interface ProjectState {
  project: Project | null;
  saveState: 'idle' | 'saving' | 'saved' | 'error';
  init(): Promise<void>;
  newProject(): Promise<void>;
  rename(name: string): void;
  setSeed(seed: number): void;
  addDataset(table: ColumnarTable, meta: Pick<DatasetRecord, 'name' | 'source' | 'warnings' | 'derivedFrom'>): Promise<DatasetRecord>;
  upsertPipeline(p: PipelineRecord): void;
  upsertScript(s: ScriptRecord): void;
  upsertGraph(g: GraphRecord): void;
  removeDataset(id: string): Promise<void>;
  getTable(id: string): Promise<ColumnarTable>;
  recordExperiment(exp: ExperimentRecord, model?: { record: ModelRecord; bytes: Uint8Array }): Promise<void>;
  removeExperiment(id: string): Promise<void>;
  exportZip(): Promise<Uint8Array>;
  importZip(bytes: Uint8Array): Promise<void>;
}

let saveTimer: ReturnType<typeof setTimeout> | undefined;

export const useProject = create<ProjectState>((set, get) => {
  const scheduleSave = () => {
    set({ saveState: 'saving' });
    clearTimeout(saveTimer);
    saveTimer = setTimeout(async () => {
      const p = get().project;
      if (!p) return;
      try {
        await storage.putProject(p);
        set({ saveState: 'saved' });
      } catch (e) {
        console.error(e);
        set({ saveState: 'error' });
      }
    }, 250);
  };
  const update = (fn: (p: Project) => Project) => {
    const p = get().project;
    if (!p) throw new Error('No project open');
    set({ project: { ...fn(p), updatedAt: Date.now() } });
    scheduleSave();
  };
  const create_ = async () => {
    const p = emptyProject(newId('p'), translate(useLocale.getState().locale, 'project.untitled'), freshSeed() % 1_000_000, APP_VERSION);
    await storage.putProject(p);
    await storage.setMeta(LAST_PROJECT, p.id);
    tableCache.clear();
    set({ project: p, saveState: 'saved' });
  };

  return {
    project: null,
    saveState: 'idle',

    async init() {
      const last = await storage.getMeta<string>(LAST_PROJECT);
      const p = last ? await storage.getProject(last) : undefined;
      if (p) set({ project: p, saveState: 'saved' });
      else await create_();
    },

    newProject: create_,

    rename: (name) => update((p) => ({ ...p, name: name.trim() || p.name })),
    setSeed: (seed) => update((p) => ({ ...p, seed: Math.max(0, Math.floor(seed)) >>> 0 })),

    async addDataset(table, meta) {
      const p = get().project!;
      const id = newId('d');
      const bytes = encodeTable(table);
      const record: DatasetRecord = {
        id,
        name: meta.name,
        source: meta.source,
        warnings: meta.warnings,
        derivedFrom: meta.derivedFrom,
        rowCount: table.rowCount,
        columns: table.columns.map((c) => profileColumn(c)),
        blobKey: datasetBlobKey(id),
        hash: contentHash(bytes),
        createdAt: Date.now(),
      };
      await storage.putBlob(p.id, record.blobKey, bytes);
      tableCache.set(id, table);
      update((q) => ({ ...q, datasets: [...q.datasets, record] }));
      return record;
    },

    upsertPipeline: (rec) =>
      update((q) => ({
        ...q,
        pipelines: q.pipelines.some((x) => x.id === rec.id) ? q.pipelines.map((x) => (x.id === rec.id ? { ...rec, updatedAt: Date.now() } : x)) : [...q.pipelines, rec],
      })),

    upsertGraph: (rec) =>
      update((q) => ({ ...q, graphs: (q.graphs ?? []).some((x) => x.id === rec.id) ? q.graphs!.map((x) => (x.id === rec.id ? rec : x)) : [...(q.graphs ?? []), rec] })),

    upsertScript: (rec) =>
      update((q) => ({
        ...q,
        scripts: q.scripts.some((x) => x.id === rec.id) ? q.scripts.map((x) => (x.id === rec.id ? rec : x)) : [...q.scripts, rec],
      })),

    async removeDataset(id) {
      const p = get().project!;
      const d = p.datasets.find((x) => x.id === id);
      if (!d) return;
      await storage.deleteBlob(p.id, d.blobKey);
      tableCache.delete(id);
      update((q) => ({ ...q, datasets: q.datasets.filter((x) => x.id !== id) }));
    },

    async getTable(id) {
      const hit = tableCache.get(id);
      if (hit) return hit;
      const p = get().project!;
      const d = p.datasets.find((x) => x.id === id);
      if (!d) throw new Error(`Dataset ${id} not found`);
      const bytes = await storage.getBlob(p.id, d.blobKey);
      if (!bytes) throw new Error(`Data for "${d.name}" is missing from browser storage`);
      const t = decodeTable(bytes);
      tableCache.set(id, t);
      return t;
    },

    async recordExperiment(exp, model) {
      const p = get().project!;
      if (model) await storage.putBlob(p.id, model.record.blobKey, model.bytes);
      update((q) => ({
        ...q,
        experiments: [exp, ...q.experiments],
        models: model ? [model.record, ...q.models] : q.models,
      }));
    },

    async removeExperiment(id) {
      const p = get().project!;
      const exp = p.experiments.find((e) => e.id === id);
      const model = exp?.modelId ? p.models.find((m) => m.id === exp.modelId) : undefined;
      if (model) await storage.deleteBlob(p.id, model.blobKey);
      update((q) => ({
        ...q,
        experiments: q.experiments.filter((e) => e.id !== id),
        models: model ? q.models.filter((m) => m.id !== model.id) : q.models,
      }));
    },

    async exportZip() {
      const p = get().project!;
      const blobs = new Map<string, Uint8Array>();
      for (const key of await storage.listBlobKeys(p.id)) {
        const b = await storage.getBlob(p.id, key);
        if (b) blobs.set(key, b);
      }
      return exportProjectZip(p, blobs);
    },

    async importZip(bytes) {
      const { project, blobs } = importProjectZip(bytes);
      // Always import as a new local project so an existing copy is never overwritten.
      const p: Project = { ...project, id: newId('p'), updatedAt: Date.now() };
      for (const [key, b] of blobs) await storage.putBlob(p.id, key, b);
      await storage.putProject(p);
      await storage.setMeta(LAST_PROJECT, p.id);
      tableCache.clear();
      set({ project: p, saveState: 'saved' });
    },
  };
});
