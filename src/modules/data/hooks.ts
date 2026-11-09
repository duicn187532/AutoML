import { useEffect, useState } from 'react';
import { pool } from '@/app/services';
import { useProject } from '@/app/stores/project';
import type { DataProfile } from '@/core/data/explore';
import type { ColumnarTable } from '@/core/data/table';

/** Load a dataset's table (cached by the project store). */
export function useTable(datasetId: string | undefined): ColumnarTable | null {
  const getTable = useProject((s) => s.getTable);
  const [loaded, setLoaded] = useState<{ id: string; table: ColumnarTable } | null>(null);
  useEffect(() => {
    let alive = true;
    if (datasetId) getTable(datasetId).then((t) => alive && setLoaded({ id: datasetId, table: t })).catch(console.error);
    return () => { alive = false; };
  }, [datasetId, getTable]);
  return loaded && loaded.id === datasetId ? loaded.table : null;
}

/** Profiles are cached per table object and target, so switching pages does not recompute them. */
const profileCache = new WeakMap<ColumnarTable, Map<string, DataProfile>>();

/** Quality report / exploration statistics, computed in a worker. */
export function useProfile(datasetId: string | undefined, table: ColumnarTable | null, target: string | undefined) {
  const [state, setState] = useState<{ key: string; profile?: DataProfile; error?: string } | null>(null);
  const key = `${datasetId}|${target ?? ''}`;
  const cached = table ? profileCache.get(table)?.get(target ?? '') : undefined;
  useEffect(() => {
    if (!table || cached) return;
    let alive = true;
    const h = pool.submit({ kind: 'profile', input: { table, target } }, { label: 'profile' });
    h.result.then((profile) => {
      const m = profileCache.get(table) ?? new Map<string, DataProfile>();
      m.set(target ?? '', profile);
      profileCache.set(table, m);
      if (alive) setState({ key, profile });
    }, (e) => alive && setState({ key, error: (e as Error).message }));
    return () => { alive = false; h.cancel(); };
  }, [table, target, key, cached]);
  if (cached) return { key, profile: cached };
  return state?.key === key ? state : null;
}

/** Columns the quality report flags as possible target leakage (empty until the profile is ready). */
export function useLeakage(datasetId: string | undefined, table: ColumnarTable | null, target: string | undefined): { ready: boolean; columns: string[] } {
  const p = useProfile(datasetId, table, target);
  return { ready: !!(p?.profile || p?.error), columns: p?.profile?.quality.filter((q) => q.check === 'leakage' && q.column).map((q) => q.column!) ?? [] };
}
