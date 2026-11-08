import type { PipelineStep } from '../project/types';
import { parseNumber } from './infer';
import { cellString, getColumn, takeRows, type Column, type ColumnarTable } from './table';

/**
 * Replayable cleaning / feature-engineering steps. Pure: (table, steps) → new table.
 * Steps that would need dataset statistics (mean imputation, scaling, target encoding) are
 * deliberately NOT here — those are fitted on training rows only at train time (core/ml/preprocess).
 * Lag / rolling features only look at PAST rows (ordered by `orderBy`) so they cannot leak the future.
 */
export interface StepLog {
  step: number;
  op: PipelineStep['op'];
  rowsBefore: number;
  rowsAfter: number;
  colsAfter: number;
  error?: string;
}

const numericCol = (name: string, values: Float64Array): Column => ({ name, kind: 'numeric', values });

function replaceOrAdd(cols: Column[], col: Column): Column[] {
  const i = cols.findIndex((c) => c.name === col.name);
  return i < 0 ? [...cols, col] : cols.map((c, k) => (k === i ? col : c));
}

function asNumbers(col: Column): Float64Array {
  if (col.kind === 'numeric') return col.values;
  return Float64Array.from(col.values, (v) => (v === null ? NaN : parseNumber(v)));
}

/** Row order by `orderBy` (stable), grouped by `groupBy` — used by lag / rolling. */
function orderedGroups(t: ColumnarTable, orderBy?: string, groupBy?: string): number[][] {
  const idx = Array.from({ length: t.rowCount }, (_, i) => i);
  if (orderBy) {
    const oc = getColumn(t, orderBy);
    const key = oc.kind === 'numeric' ? (i: number) => oc.values[i] : (i: number) => oc.values[i] ?? '';
    idx.sort((a, b) => { const x = key(a), y = key(b); return x < y ? -1 : x > y ? 1 : a - b; });
  }
  if (!groupBy) return [idx];
  const gc = getColumn(t, groupBy);
  const groups = new Map<string, number[]>();
  for (const i of idx) {
    const g = cellString(gc, i) ?? '__missing__';
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g)!.push(i);
  }
  return [...groups.values()];
}

function compare(col: Column, i: number, cmp: string, value: string | undefined): boolean {
  const s = cellString(col, i);
  if (cmp === 'isna') return s === null;
  if (cmp === 'notna') return s !== null;
  if (s === null) return false;
  if (cmp === 'in' || cmp === 'notin') {
    const set = new Set((value ?? '').split(',').map((x) => x.trim()));
    return set.has(s) === (cmp === 'in');
  }
  const a = col.kind === 'numeric' ? col.values[i] : NaN;
  const b = parseNumber(value ?? '');
  const numeric = col.kind === 'numeric' && !Number.isNaN(b);
  const x: number | string = numeric ? a : s, y: number | string = numeric ? b : (value ?? '');
  switch (cmp) {
    case '<': return x < y;
    case '<=': return x <= y;
    case '>': return x > y;
    case '>=': return x >= y;
    case '==': return x === y;
    case '!=': return x !== y;
  }
  return true;
}

export function applyStep(t: ColumnarTable, s: PipelineStep): ColumnarTable {
  switch (s.op) {
    case 'dropColumns': {
      const drop = new Set(s.columns);
      return { rowCount: t.rowCount, columns: t.columns.filter((c) => !drop.has(c.name)) };
    }
    case 'renameColumn': {
      if (!s.to.trim()) throw new Error('empty name');
      if (t.columns.some((c) => c.name === s.to)) throw new Error(`column "${s.to}" exists`);
      getColumn(t, s.from);
      return { rowCount: t.rowCount, columns: t.columns.map((c) => (c.name === s.from ? { ...c, name: s.to } : c)) };
    }
    case 'setKind': {
      const c = getColumn(t, s.column);
      let out: Column;
      if (s.kind === 'numeric') out = numericCol(c.name, asNumbers(c));
      else if (c.kind === 'numeric') out = { name: c.name, kind: s.kind, values: Array.from(c.values, (v) => (Number.isNaN(v) ? null : String(v))) };
      else out = { name: c.name, kind: s.kind, values: c.values };
      return { rowCount: t.rowCount, columns: replaceOrAdd(t.columns, out) };
    }
    case 'dropMissingRows': {
      const cols = s.columns.length ? s.columns.map((n) => getColumn(t, n)) : t.columns;
      const keep: number[] = [];
      for (let i = 0; i < t.rowCount; i++) if (cols.every((c) => cellString(c, i) !== null)) keep.push(i);
      return takeRows(t, keep);
    }
    case 'fillMissing': {
      const c = getColumn(t, s.column);
      let out: Column;
      if (c.kind === 'numeric') {
        const v = parseNumber(s.value);
        if (Number.isNaN(v)) throw new Error('fill value must be numeric');
        out = numericCol(c.name, c.values.map((x) => (Number.isNaN(x) ? v : x)));
      } else out = { ...c, values: c.values.map((x) => x ?? s.value) };
      return { rowCount: t.rowCount, columns: replaceOrAdd(t.columns, out) };
    }
    case 'filterRows': {
      const c = getColumn(t, s.column);
      const keep: number[] = [];
      for (let i = 0; i < t.rowCount; i++) if (compare(c, i, s.cmp, s.value)) keep.push(i);
      return takeRows(t, keep);
    }
    case 'dropDuplicates': {
      const cols = s.columns.length ? s.columns.map((n) => getColumn(t, n)) : t.columns;
      const seen = new Set<string>();
      const keep: number[] = [];
      for (let i = 0; i < t.rowCount; i++) {
        const key = JSON.stringify(cols.map((c) => cellString(c, i)));
        if (!seen.has(key)) { seen.add(key); keep.push(i); }
      }
      return takeRows(t, keep);
    }
    case 'dateExpand': {
      const c = getColumn(t, s.column);
      const parts = s.parts.map(() => new Float64Array(t.rowCount).fill(NaN));
      for (let i = 0; i < t.rowCount; i++) {
        const v = cellString(c, i);
        const ms = v === null ? NaN : Date.parse(v.replace(/\//g, '-'));
        if (Number.isNaN(ms)) continue;
        const d = new Date(ms);
        s.parts.forEach((p, k) => {
          parts[k][i] = p === 'year' ? d.getUTCFullYear() : p === 'month' ? d.getUTCMonth() + 1 : p === 'day' ? d.getUTCDate() : p === 'dow' ? d.getUTCDay() : d.getUTCHours();
        });
      }
      let cols = s.drop ? t.columns.filter((x) => x.name !== s.column) : t.columns;
      s.parts.forEach((p, k) => { cols = replaceOrAdd(cols, numericCol(`${s.column}_${p}`, parts[k])); });
      return { rowCount: t.rowCount, columns: cols };
    }
    case 'mathTransform': {
      const x = asNumbers(getColumn(t, s.column));
      const f = { log1p: (v: number) => (v > -1 ? Math.log1p(v) : NaN), sqrt: (v: number) => (v >= 0 ? Math.sqrt(v) : NaN), abs: Math.abs, square: (v: number) => v * v }[s.fn];
      return { rowCount: t.rowCount, columns: replaceOrAdd(t.columns, numericCol(s.output || `${s.fn}(${s.column})`, x.map(f))) };
    }
    case 'interaction': {
      const a = asNumbers(getColumn(t, s.a)), b = asNumbers(getColumn(t, s.b));
      const out = new Float64Array(t.rowCount);
      for (let i = 0; i < out.length; i++) {
        out[i] = s.fn === '*' ? a[i] * b[i] : s.fn === '/' ? (b[i] === 0 ? NaN : a[i] / b[i]) : s.fn === '+' ? a[i] + b[i] : a[i] - b[i];
      }
      return { rowCount: t.rowCount, columns: replaceOrAdd(t.columns, numericCol(s.output || `${s.a}${s.fn}${s.b}`, out)) };
    }
    case 'lag': {
      const x = asNumbers(getColumn(t, s.column));
      const outs = s.lags.map(() => new Float64Array(t.rowCount).fill(NaN));
      for (const g of orderedGroups(t, s.orderBy, s.groupBy)) {
        for (let k = 0; k < g.length; k++) s.lags.forEach((L, j) => { if (L > 0 && k - L >= 0) outs[j][g[k]] = x[g[k - L]]; });
      }
      let cols = t.columns;
      s.lags.forEach((L, j) => { cols = replaceOrAdd(cols, numericCol(`${s.column}_lag${L}`, outs[j])); });
      return { rowCount: t.rowCount, columns: cols };
    }
    case 'rolling': {
      if (s.window < 1) throw new Error('window must be ≥ 1');
      const x = asNumbers(getColumn(t, s.column));
      const out = new Float64Array(t.rowCount).fill(NaN);
      for (const g of orderedGroups(t, s.orderBy, s.groupBy)) {
        for (let k = 1; k < g.length; k++) {
          // window over the PREVIOUS `window` rows (excludes the current row)
          const vals: number[] = [];
          for (let q = Math.max(0, k - s.window); q < k; q++) if (!Number.isNaN(x[g[q]])) vals.push(x[g[q]]);
          if (!vals.length) continue;
          const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
          out[g[k]] = s.stat === 'mean' ? mean : s.stat === 'min' ? Math.min(...vals) : s.stat === 'max' ? Math.max(...vals)
            : vals.length > 1 ? Math.sqrt(vals.reduce((a, v) => a + (v - mean) ** 2, 0) / (vals.length - 1)) : NaN;
        }
      }
      return { rowCount: t.rowCount, columns: replaceOrAdd(t.columns, numericCol(`${s.column}_roll${s.window}_${s.stat}`, out)) };
    }
  }
}

/** Apply steps in order. A failing step is logged and skipped (so the editor stays usable). */
export function applyPipeline(table: ColumnarTable, steps: PipelineStep[]): { table: ColumnarTable; log: StepLog[] } {
  let t = table;
  const log: StepLog[] = [];
  steps.forEach((s, step) => {
    const rowsBefore = t.rowCount;
    try {
      t = applyStep(t, s);
      log.push({ step, op: s.op, rowsBefore, rowsAfter: t.rowCount, colsAfter: t.columns.length });
    } catch (e) {
      log.push({ step, op: s.op, rowsBefore, rowsAfter: t.rowCount, colsAfter: t.columns.length, error: (e as Error).message });
    }
  });
  return { table: t, log };
}
