import Papa from 'papaparse';
import { inferTable, type InferOptions } from './infer';
import type { ColumnarTable } from './table';

/** Decode bytes as UTF-8, falling back to Big5 (common for Traditional Chinese Excel exports). */
export function decodeText(bytes: Uint8Array): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    try {
      return new TextDecoder('big5').decode(bytes);
    } catch {
      return new TextDecoder('utf-8').decode(bytes);
    }
  }
}

/** Parse CSV text into a typed ColumnarTable. Runs inside a worker. */
export function parseCsv(text: string, opts: InferOptions = {}): { table: ColumnarTable; warnings: string[] } {
  const res = Papa.parse<string[]>(text.replace(/^\ufeff/, ''), { skipEmptyLines: 'greedy' });
  const warnings = res.errors.slice(0, 20).map((e) => `row ${e.row ?? '?'}: ${e.message}`);
  const rows = res.data;
  if (rows.length === 0) throw new Error('CSV is empty');
  const header = rows[0];
  const width = header.length;
  const raw: (string | null)[][] = Array.from({ length: width }, () => new Array(rows.length - 1));
  let ragged = 0;
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (r.length !== width) ragged++;
    for (let j = 0; j < width; j++) raw[j][i - 1] = r[j] ?? null;
  }
  if (ragged) warnings.push(`${ragged} rows have a different number of fields than the header`);
  return { table: inferTable(header, raw, opts), warnings };
}
