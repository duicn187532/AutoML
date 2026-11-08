import { describe, expect, it } from 'vitest';
import { csvCell, toCsv } from '@/core/data/csv';
import { escapeHtml, jsonForScript, safeFileName } from '@/core/security/escape';

describe('escapeHtml', () => {
  it('escapes markup in column names (legacy injection bug)', () => {
    expect(escapeHtml('<img src=x onerror=alert(1)>')).toBe('&lt;img src=x onerror=alert(1)&gt;');
    expect(escapeHtml(`"'&\``)).toBe('&quot;&#39;&amp;&#96;');
    expect(escapeHtml(null)).toBe('');
  });
  it('jsonForScript cannot close a script tag', () => {
    const s = jsonForScript({ a: '</script><script>alert(1)</script>' });
    expect(s).not.toContain('</script>');
    expect(JSON.parse(s).a).toBe('</script><script>alert(1)</script>');
  });
  it('safeFileName strips path characters but keeps CJK', () => {
    expect(safeFileName('../a/b:c*?.zip')).toBe('_a_b_c__.zip');
    expect(safeFileName('抵押品 估值')).toBe('抵押品 估值');
    expect(safeFileName('...')).toBe('file');
  });
});

describe('CSV writer', () => {
  it('quotes delimiters, quotes, newlines and edge whitespace', () => {
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell('line1\nline2')).toBe('"line1\nline2"');
    expect(csvCell(' pad')).toBe('" pad"');
    expect(csvCell(NaN)).toBe('');
    expect(csvCell(null)).toBe('');
    expect(csvCell(1.5)).toBe('1.5');
  });
  it('guards spreadsheet formulas when asked, but not negative numbers', () => {
    expect(csvCell('=SUM(A1)', { guardFormulas: true })).toBe("'=SUM(A1)");
    expect(csvCell('-12.5', { guardFormulas: true })).toBe('-12.5');
    expect(csvCell('@cmd', { guardFormulas: true })).toBe("'@cmd");
  });
  it('builds a full document with BOM and CRLF', () => {
    const doc = toCsv(['名稱', 'v'], [['a,b', 1], [null, 2]], { bom: true });
    expect(doc).toBe('\ufeff名稱,v\r\n"a,b",1\r\n,2\r\n');
  });
});
