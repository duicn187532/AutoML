/** CSV writing with correct RFC 4180 quoting (legacy export broke on commas/quotes/newlines). */
export interface CsvWriteOptions {
  delimiter?: string;
  /** Prefix cells starting with = + - @ \t \r with ' to stop spreadsheet formula injection. */
  guardFormulas?: boolean;
  /** Prepend UTF-8 BOM so Excel detects encoding (CJK headers). */
  bom?: boolean;
}

const FORMULA_START = /^[=+\-@\t\r]/;

export function csvCell(value: unknown, opts: CsvWriteOptions = {}): string {
  const delimiter = opts.delimiter ?? ',';
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') {
    if (Number.isNaN(value)) return '';
    return String(value);
  }
  let s = String(value);
  if (opts.guardFormulas && FORMULA_START.test(s) && !/^[-+]?\d*\.?\d+(e[-+]?\d+)?$/i.test(s)) s = `'${s}`;
  if (s.includes('"') || s.includes(delimiter) || s.includes('\n') || s.includes('\r') || /^\s|\s$/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function toCsv(header: string[], rows: unknown[][], opts: CsvWriteOptions = {}): string {
  const d = opts.delimiter ?? ',';
  const lines = [header.map((h) => csvCell(h, opts)).join(d)];
  for (const r of rows) lines.push(r.map((c) => csvCell(c, opts)).join(d));
  return (opts.bom ? '\ufeff' : '') + lines.join('\r\n') + '\r\n';
}
