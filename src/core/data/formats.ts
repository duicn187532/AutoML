import { parquetReadObjects } from 'hyparquet';
import { inferTable } from './infer';
import { decodeText, parseCsv } from './parse';
import type { ColumnarTable } from './table';

/** File formats the Data Prep module can import. Excel needs the on-demand `xlsx` engine (SheetJS). */
export type FileFormat = 'csv' | 'json' | 'jsonl' | 'xlsx' | 'parquet';

export function detectFormat(fileName: string): FileFormat {
  const ext = fileName.toLowerCase().split('.').pop() ?? '';
  if (ext === 'xlsx' || ext === 'xls' || ext === 'xlsm' || ext === 'ods') return 'xlsx';
  if (ext === 'parquet' || ext === 'pq') return 'parquet';
  if (ext === 'json') return 'json';
  if (ext === 'jsonl' || ext === 'ndjson') return 'jsonl';
  return 'csv';
}

export const ACCEPTED_EXTENSIONS = '.csv,.tsv,.txt,.json,.jsonl,.ndjson,.xlsx,.xls,.xlsm,.ods,.parquet';

function cell(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v.toISOString().replace('T00:00:00.000Z', '');
  if (typeof v === 'bigint') return v.toString();
  if (typeof v === 'object') return JSON.stringify(v, (_k, x) => (typeof x === 'bigint' ? x.toString() : x));
  return String(v);
}

/** Array of row objects → typed table (union of keys, first-seen order). */
export function objectsToTable(rows: Record<string, unknown>[]): ColumnarTable {
  const keys: string[] = [];
  const seen = new Set<string>();
  for (const r of rows) for (const k of Object.keys(r ?? {})) if (!seen.has(k)) { seen.add(k); keys.push(k); }
  return inferTable(keys, keys.map((k) => rows.map((r) => cell(r?.[k]))));
}

/** Array of arrays with a header row → typed table. */
export function matrixToTable(matrix: unknown[][]): ColumnarTable {
  const [header = [], ...body] = matrix;
  const width = Math.max(header.length, ...body.map((r) => r.length));
  const names = Array.from({ length: width }, (_, j) => cell(header[j]) ?? '');
  return inferTable(names, names.map((_, j) => body.map((r) => cell(r[j]))));
}

export function parseJson(text: string, lines: boolean): ColumnarTable {
  if (lines) return objectsToTable(text.split(/\r?\n/).filter((l) => l.trim()).map((l) => JSON.parse(l)));
  const data = JSON.parse(text) as unknown;
  const arr = Array.isArray(data) ? data : Array.isArray((data as { data?: unknown }).data) ? (data as { data: unknown[] }).data : null;
  if (arr) return Array.isArray(arr[0]) ? matrixToTable(arr as unknown[][]) : objectsToTable(arr as Record<string, unknown>[]);
  // column-oriented { col: [values] }
  const obj = data as Record<string, unknown[]>;
  const keys = Object.keys(obj);
  if (keys.length && keys.every((k) => Array.isArray(obj[k]))) return inferTable(keys, keys.map((k) => obj[k].map(cell)));
  throw new Error('JSON must be an array of records, an array of arrays, or { column: [values] }');
}

interface SheetJs {
  read(data: Uint8Array, opts: Record<string, unknown>): { SheetNames: string[]; Sheets: Record<string, unknown> };
  utils: { sheet_to_json(ws: unknown, opts: Record<string, unknown>): unknown[][] };
}

export function parseExcel(bytes: Uint8Array, XLSX: SheetJs, sheet?: string): { table: ColumnarTable; sheets: string[] } {
  const wb = XLSX.read(bytes, { type: 'array', cellDates: true, dense: true });
  const name = sheet && wb.SheetNames.includes(sheet) ? sheet : wb.SheetNames[0];
  if (!name) throw new Error('Workbook has no sheets');
  const matrix = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, raw: true, defval: null, blankrows: false });
  return { table: matrixToTable(matrix), sheets: wb.SheetNames };
}

export async function parseParquet(bytes: Uint8Array): Promise<ColumnarTable> {
  const buf = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  const rows = (await parquetReadObjects({ file: buf })) as Record<string, unknown>[];
  return objectsToTable(rows);
}

export async function parseAny(bytes: Uint8Array, fileName: string, engines: { xlsx?: () => SheetJs }, sheet?: string): Promise<{ table: ColumnarTable; warnings: string[]; sheets?: string[] }> {
  const fmt = detectFormat(fileName);
  if (fmt === 'csv') return parseCsv(decodeText(bytes));
  if (fmt === 'json' || fmt === 'jsonl') return { table: parseJson(decodeText(bytes), fmt === 'jsonl'), warnings: [] };
  if (fmt === 'parquet') return { table: await parseParquet(bytes), warnings: [] };
  if (!engines.xlsx) throw new Error('Excel engine not loaded');
  const r = parseExcel(bytes, engines.xlsx(), sheet);
  return { ...r, warnings: r.sheets.length > 1 ? [`sheets: ${r.sheets.join(', ')} (imported "${sheet ?? r.sheets[0]}")`] : [] };
}
