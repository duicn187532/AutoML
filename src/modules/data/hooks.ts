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

/** Quality report / exploration statistics, computed in a worker. */
export function useProfile(datasetId: string | undefined, table: ColumnarTable | null, target: string | undefined) {
  const [state, setState] = useState<{ key: string; profile?: DataProfile; error?: string } | null>(null);
  const key = `${datasetId}|${target ?? ''}`;
  useEffect(() => {
    if (!table) return;
    let alive = true;
    const h = pool.submit({ kind: 'profile', input: { table, target } }, { label: 'profile' });
    h.result.then((profile) => alive && setState({ key, profile }), (e) => alive && setState({ key, error: (e as Error).message }));
    return () => { alive = false; h.cancel(); };
  }, [table, target, key]);
  return state?.key === key ? state : null;
}
