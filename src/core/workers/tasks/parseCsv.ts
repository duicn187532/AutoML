import { detectFormat, parseAny } from '../../data/formats';
import type { ParseCsvInput, ParseCsvOutput, TaskContext } from '../types';

/** Parse an uploaded file (CSV / TSV / JSON / JSONL / Excel / Parquet) into a typed table. */
export async function parseCsvTask(input: ParseCsvInput, ctx: TaskContext): Promise<ParseCsvOutput> {
  ctx.progress({ fraction: 0.1, message: 'parse' });
  const xlsx = detectFormat(input.fileName) === 'xlsx' ? () => ctx.engine<never>('xlsx') : undefined;
  const out = await parseAny(new Uint8Array(input.bytes), input.fileName, { xlsx }, input.sheet);
  ctx.progress({ fraction: 1 });
  return out;
}
