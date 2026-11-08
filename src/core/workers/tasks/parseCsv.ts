import { decodeText, parseCsv } from '../../data/parse';
import type { ParseCsvInput, ParseCsvOutput, TaskContext } from '../types';

export async function parseCsvTask(input: ParseCsvInput, ctx: TaskContext): Promise<ParseCsvOutput> {
  ctx.progress({ fraction: 0.1, message: 'decode' });
  const text = decodeText(new Uint8Array(input.bytes));
  await ctx.checkpoint();
  ctx.progress({ fraction: 0.3, message: 'parse' });
  const out = parseCsv(text);
  ctx.progress({ fraction: 1 });
  return out;
}
