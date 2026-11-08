import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { contentHash, decodeTable, encodeTable } from '@/core/data/codec';
import { inferTable, parseNumber } from '@/core/data/infer';
import { decodeText, parseCsv } from '@/core/data/parse';
import { profileColumn, takeRows } from '@/core/data/table';

describe('type inference', () => {
  it('scans all rows and recognises NA strings', () => {
    const vals = Array.from({ length: 500 }, (_, i) => String(i % 7));
    vals[450] = 'oops'; // beyond any 200-row sample (legacy bug)
    const t = inferTable(['x', 'y'], [vals, vals.map((_, i) => (i % 10 === 0 ? 'NA' : String(i * 0.5)))]);
    expect(t.columns[0].kind).toBe('categorical');
    expect(t.columns[1].kind).toBe('numeric');
    expect(profileColumn(t.columns[1]).missing).toBe(50);
  });

  it('detects id, datetime, text and categorical columns', () => {
    const n = 200;
    const t = inferTable(
      ['Id', 'date', 'note', 'city', 'amount'],
      [
        Array.from({ length: n }, (_, i) => String(i + 1)),
        Array.from({ length: n }, (_, i) => `2024-01-${String((i % 28) + 1).padStart(2, '0')}`),
        Array.from({ length: n }, (_, i) => `free text comment number ${i} with some more words`),
        Array.from({ length: n }, (_, i) => ['台北', '台中', '高雄'][i % 3]),
        Array.from({ length: n }, (_, i) => (i % 2 ? '1,234.5' : '-3e2')),
      ],
    );
    expect(t.columns.map((c) => c.kind)).toEqual(['id', 'datetime', 'text', 'categorical', 'numeric']);
    expect(parseNumber('1,234.5')).toBe(1234.5);
  });

  it('dedupes header names and strips BOM', () => {
    const t = inferTable(['\ufeffa', 'a', ''], [['1'], ['2'], ['3']]);
    expect(t.columns.map((c) => c.name)).toEqual(['a', 'a_2', 'column_3']);
  });
});

describe('CSV parsing', () => {
  it('parses the bundled classification sample (UTF-8 BOM, CJK header)', () => {
    const text = decodeText(readFileSync('samples/collateral-classification.csv'));
    const { table } = parseCsv(text);
    expect(table.columns[0].name).toBe('地段');
    expect(table.columns.at(-1)!.name).toBe('價位區間');
    expect(table.rowCount).toBeGreaterThan(100);
    expect(table.columns.every((c) => c.kind === 'numeric')).toBe(true);
  });

  it('parses House Prices, treating "NA" as missing', () => {
    const { table } = parseCsv(readFileSync('samples/house-prices-train.csv', 'utf8'));
    expect(table.rowCount).toBe(1460);
    expect(table.columns.find((c) => c.name === 'Id')!.kind).toBe('id');
    const alley = profileColumn(table.columns.find((c) => c.name === 'Alley')!);
    expect(alley.kind).toBe('categorical');
    expect(alley.missing).toBe(1369);
    expect(table.columns.find((c) => c.name === 'SalePrice')!.kind).toBe('numeric');
  });

  it('handles quoted fields with commas/newlines and ragged rows', () => {
    const { table, warnings } = parseCsv('a,b\n"x, y","multi\nline"\n1\n');
    expect(table.rowCount).toBe(2);
    expect(table.columns[0].values[0]).toBe('x, y');
    expect(table.columns[1].values[0]).toBe('multi\nline');
    expect(warnings.length).toBeGreaterThan(0);
  });

  it('falls back to Big5', () => {
    const big5 = new Uint8Array([0xa4, 0xa4, 0xa4, 0xe5]); // 中文
    expect(decodeText(big5)).toBe('中文');
  });
});

describe('table codec', () => {
  it('round-trips numeric and string columns', () => {
    const t = inferTable(['n', 's'], [['1.5', 'NA', '3'], ['a', null, 'c"d']]);
    const bytes = encodeTable(t);
    const back = decodeTable(bytes);
    expect(back.rowCount).toBe(3);
    expect(Array.from(back.columns[0].values as Float64Array)).toEqual([1.5, NaN, 3]);
    expect(back.columns[1].values).toEqual(['a', null, 'c"d']);
    expect(contentHash(bytes)).toBe(contentHash(encodeTable(t)));
    expect(contentHash(bytes)).not.toBe(contentHash(encodeTable(takeRows(t, [0, 1]))));
  });
});
