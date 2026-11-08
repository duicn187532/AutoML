import type { Column, ColumnKind, ColumnarTable } from './table';

/** Strings treated as missing (case-sensitive set + trimmed). Scans ALL rows, not a sample. */
export const DEFAULT_NA_STRINGS = ['', 'NA', 'N/A', 'n/a', 'NaN', 'nan', 'NULL', 'null', 'None', 'none', '#N/A', '?'];

const NUMERIC_RE = /^[-+]?(\d+(\.\d*)?|\.\d+)([eE][-+]?\d+)?$/;
const THOUSANDS_RE = /^[-+]?\d{1,3}(,\d{3})+(\.\d+)?$/;
const DATE_RE = /^\d{4}[-/]\d{1,2}[-/]\d{1,2}([ T]\d{1,2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?)?$/;

export interface InferOptions {
  naStrings?: string[];
  /** Max unique ratio for a string column to be categorical (default 0.5 when ≤ 50 unique else 0.05). */
  maxCategoricalUnique?: number;
  /** Mean length above which a high-cardinality string column is "text". */
  textMinMeanLength?: number;
  /** Forced kinds by column name. */
  overrides?: Record<string, ColumnKind>;
}

export function parseNumber(s: string): number {
  const t = s.trim();
  if (NUMERIC_RE.test(t)) return Number(t);
  if (THOUSANDS_RE.test(t)) return Number(t.replace(/,/g, ''));
  return NaN;
}

/**
 * Build a typed ColumnarTable from raw string columns.
 * Detection order: numeric → datetime → id → categorical → text.
 */
export function inferTable(header: string[], rawColumns: (string | null | undefined)[][], opts: InferOptions = {}): ColumnarTable {
  const na = new Set(opts.naStrings ?? DEFAULT_NA_STRINGS);
  const rowCount = rawColumns[0]?.length ?? 0;
  const names = dedupeNames(header);
  const columns = names.map((name, j) => inferColumn(name, rawColumns[j] ?? [], rowCount, na, opts));
  return { rowCount, columns };
}

export function dedupeNames(header: string[]): string[] {
  const seen = new Map<string, number>();
  return header.map((h, i) => {
    let name = (h ?? '').replace(/^\ufeff/, '').trim() || `column_${i + 1}`;
    const n = seen.get(name) ?? 0;
    seen.set(name, n + 1);
    if (n > 0) name = `${name}_${n + 1}`;
    return name;
  });
}

function inferColumn(name: string, raw: (string | null | undefined)[], n: number, na: Set<string>, opts: InferOptions): Column {
  const vals: (string | null)[] = new Array(n);
  let nonMissing = 0, numeric = 0, dates = 0, lenSum = 0;
  for (let i = 0; i < n; i++) {
    const r = raw[i];
    const s = r === null || r === undefined ? null : String(r).trim();
    if (s === null || na.has(s)) { vals[i] = null; continue; }
    vals[i] = s;
    nonMissing++;
    lenSum += s.length;
    if (!Number.isNaN(parseNumber(s))) numeric++;
    else if (DATE_RE.test(s)) dates++;
  }
  const forced = opts.overrides?.[name];
  const unique = new Set<string>();
  for (const v of vals) if (v !== null) unique.add(v);

  let kind: ColumnKind;
  if (forced) kind = forced;
  else if (nonMissing === 0) kind = 'categorical';
  else if (numeric === nonMissing) kind = looksLikeId(name, vals, unique.size, nonMissing, true) ? 'id' : 'numeric';
  else if (dates === nonMissing) kind = 'datetime';
  else {
    const meanLen = lenSum / nonMissing;
    const ratio = unique.size / nonMissing;
    const maxCat = opts.maxCategoricalUnique ?? Math.max(50, Math.floor(0.05 * nonMissing));
    if (unique.size <= maxCat) kind = 'categorical';
    else if (meanLen >= (opts.textMinMeanLength ?? 25)) kind = 'text';
    else if (ratio > 0.95 && looksLikeId(name, vals, unique.size, nonMissing, false)) kind = 'id';
    else kind = 'categorical';
  }

  if (kind === 'numeric') {
    const v = new Float64Array(n);
    for (let i = 0; i < n; i++) v[i] = vals[i] === null ? NaN : parseNumber(vals[i] as string);
    return { name, kind, values: v };
  }
  return { name, kind, values: vals };
}

const ID_NAME_RE = /(^|[_\s-])(id|uuid|guid|key|編號|代碼|序號)$|^(id|uuid|index|編號|序號)$/i;

function looksLikeId(name: string, vals: (string | null)[], unique: number, nonMissing: number, numeric: boolean): boolean {
  if (unique !== nonMissing || nonMissing < 3) return false;
  if (ID_NAME_RE.test(name.trim())) return true;
  if (!numeric) return /^[A-Za-z0-9_-]{6,}$/.test(vals.find((v) => v !== null) ?? '');
  // consecutive integers 0/1..n → row index
  let prev = -Infinity, step = 0;
  for (const s of vals) {
    if (s === null) continue;
    const x = Number(s);
    if (!Number.isInteger(x)) return false;
    if (prev !== -Infinity) {
      if (step === 0) step = x - prev;
      if (x - prev !== step || step !== 1) return false;
    }
    prev = x;
  }
  return true;
}
