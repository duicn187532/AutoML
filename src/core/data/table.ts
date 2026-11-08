/**
 * Columnar in-memory table — the unit exchanged between UI, workers, and storage.
 * Numeric columns: Float64Array with NaN = missing. Others: (string | null)[] with null = missing.
 */
export type ColumnKind = 'numeric' | 'categorical' | 'text' | 'datetime' | 'id';

export type Column =
  | { name: string; kind: 'numeric'; values: Float64Array }
  | { name: string; kind: Exclude<ColumnKind, 'numeric'>; values: (string | null)[] };

export interface ColumnarTable {
  rowCount: number;
  columns: Column[];
}

export interface ColumnProfile {
  name: string;
  kind: ColumnKind;
  missing: number;
  unique: number;
  /** numeric only */
  min?: number;
  max?: number;
  mean?: number;
  std?: number;
  /** top categories (categorical/text/id), most frequent first */
  top?: { value: string; count: number }[];
}

export function getColumn(table: ColumnarTable, name: string): Column {
  const c = table.columns.find((col) => col.name === name);
  if (!c) throw new Error(`Column not found: ${name}`);
  return c;
}

export function isMissing(col: Column, i: number): boolean {
  return col.kind === 'numeric' ? Number.isNaN(col.values[i]) : col.values[i] === null;
}

/** String view of a cell (for previews / category keys). */
export function cellString(col: Column, i: number): string | null {
  if (col.kind === 'numeric') {
    const v = col.values[i];
    return Number.isNaN(v) ? null : String(v);
  }
  return col.values[i];
}

export function profileColumn(col: Column, topK = 10): ColumnProfile {
  const n = col.values.length;
  if (col.kind === 'numeric') {
    let missing = 0, count = 0, mean = 0, m2 = 0, min = Infinity, max = -Infinity;
    const seen = new Set<number>();
    for (let i = 0; i < n; i++) {
      const v = col.values[i];
      if (Number.isNaN(v)) { missing++; continue; }
      count++;
      const d = v - mean;
      mean += d / count;
      m2 += d * (v - mean);
      if (v < min) min = v;
      if (v > max) max = v;
      if (seen.size <= 100000) seen.add(v);
    }
    return {
      name: col.name, kind: col.kind, missing, unique: seen.size,
      min: count ? min : undefined, max: count ? max : undefined,
      mean: count ? mean : undefined, std: count > 1 ? Math.sqrt(m2 / (count - 1)) : undefined,
    };
  }
  const counts = new Map<string, number>();
  let missing = 0;
  for (let i = 0; i < n; i++) {
    const v = col.values[i];
    if (v === null) { missing++; continue; }
    counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  const top = [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))
    .slice(0, topK)
    .map(([value, count]) => ({ value, count }));
  return { name: col.name, kind: col.kind, missing, unique: counts.size, top };
}

/** Select rows by index (returns a new table). */
export function takeRows(table: ColumnarTable, idx: ArrayLike<number>): ColumnarTable {
  const columns = table.columns.map((c): Column => {
    if (c.kind === 'numeric') {
      const v = new Float64Array(idx.length);
      for (let i = 0; i < idx.length; i++) v[i] = c.values[idx[i]];
      return { name: c.name, kind: 'numeric', values: v };
    }
    const v: (string | null)[] = new Array(idx.length);
    for (let i = 0; i < idx.length; i++) v[i] = c.values[idx[i]];
    return { name: c.name, kind: c.kind, values: v };
  });
  return { rowCount: idx.length, columns };
}

/** Transferable buffers of a table (for postMessage). */
export function tableTransferables(table: ColumnarTable): ArrayBuffer[] {
  return table.columns.flatMap((c) => (c.kind === 'numeric' ? [c.values.buffer as ArrayBuffer] : []));
}
