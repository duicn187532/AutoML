import type { Column, ColumnKind, ColumnarTable } from './table';

/**
 * Binary encoding of a ColumnarTable (IndexedDB blobs and project .zip).
 * Layout: "AMLT" | u32 headerLength | header JSON (UTF-8) | pad to 8 | column payloads (8-aligned)
 */
const MAGIC = 0x544c4d41; // "AMLT" little-endian

interface Header {
  formatVersion: 1;
  rowCount: number;
  columns: { name: string; kind: ColumnKind; enc: 'f64' | 'json'; offset: number; length: number }[];
}

const align8 = (n: number) => (n + 7) & ~7;

export function encodeTable(table: ColumnarTable): Uint8Array {
  const enc = new TextEncoder();
  const payloads: Uint8Array[] = [];
  const cols: Header['columns'] = [];
  let offset = 0;
  for (const c of table.columns) {
    let bytes: Uint8Array;
    if (c.kind === 'numeric') bytes = new Uint8Array(c.values.buffer, c.values.byteOffset, c.values.byteLength);
    else bytes = enc.encode(JSON.stringify(c.values));
    cols.push({ name: c.name, kind: c.kind, enc: c.kind === 'numeric' ? 'f64' : 'json', offset, length: bytes.byteLength });
    payloads.push(bytes);
    offset = align8(offset + bytes.byteLength);
  }
  const header = enc.encode(JSON.stringify({ formatVersion: 1, rowCount: table.rowCount, columns: cols } satisfies Header));
  const dataStart = align8(8 + header.byteLength);
  const out = new Uint8Array(dataStart + offset);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, MAGIC, true);
  dv.setUint32(4, header.byteLength, true);
  out.set(header, 8);
  cols.forEach((c, i) => out.set(payloads[i], dataStart + c.offset));
  return out;
}

export function decodeTable(bytes: Uint8Array): ColumnarTable {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (dv.getUint32(0, true) !== MAGIC) throw new Error('Not an AML table blob');
  const headerLen = dv.getUint32(4, true);
  const dec = new TextDecoder();
  const header = JSON.parse(dec.decode(bytes.subarray(8, 8 + headerLen))) as Header;
  if (header.formatVersion !== 1) throw new Error(`Unsupported table format ${header.formatVersion}`);
  const dataStart = align8(8 + headerLen);
  const columns = header.columns.map((c): Column => {
    const start = dataStart + c.offset;
    if (c.enc === 'f64') {
      // copy into a fresh, aligned buffer
      const buf = bytes.slice(start, start + c.length);
      return { name: c.name, kind: 'numeric', values: new Float64Array(buf.buffer, 0, c.length / 8) };
    }
    const values = JSON.parse(dec.decode(bytes.subarray(start, start + c.length))) as (string | null)[];
    return { name: c.name, kind: c.kind as Exclude<ColumnKind, 'numeric'>, values };
  });
  return { rowCount: header.rowCount, columns };
}

/** Short content hash (FNV-1a 64 via two 32-bit lanes) — used as dataset version id. */
export function contentHash(bytes: Uint8Array): string {
  let h1 = 0x811c9dc5, h2 = 0x01000193 ^ bytes.length;
  for (let i = 0; i < bytes.length; i++) {
    h1 = Math.imul(h1 ^ bytes[i], 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ bytes[i], 0x5bd1e995) >>> 0;
  }
  return h1.toString(16).padStart(8, '0') + h2.toString(16).padStart(8, '0');
}
