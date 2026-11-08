/**
 * JSON with binary sidecars: typed arrays anywhere in the value are moved into an aligned
 * binary section and replaced by {"$bin": i, "type": "..."} references.
 * Layout: "AMLB" | u32 jsonLength | JSON | pad8 | buffers (each 8-aligned)
 */
const MAGIC = 0x424c4d41; // "AMLB"
type TA = Uint8Array | Float64Array | Float32Array | Int32Array;
const CTORS = { Uint8Array, Float64Array, Float32Array, Int32Array } as const;
type TAName = keyof typeof CTORS;
const align8 = (n: number) => (n + 7) & ~7;

export function encodeBinJson(value: unknown): Uint8Array {
  const bufs: { name: TAName; bytes: Uint8Array }[] = [];
  const json = JSON.stringify(value, function (_k, v) {
    for (const name of Object.keys(CTORS) as TAName[]) {
      if (v instanceof CTORS[name]) {
        const ta = v as TA;
        bufs.push({ name, bytes: new Uint8Array(ta.buffer, ta.byteOffset, ta.byteLength) });
        return { $bin: bufs.length - 1, type: name };
      }
    }
    return v;
  });
  const header = new TextEncoder().encode(json);
  const offsets: number[] = [];
  let off = align8(8 + header.byteLength);
  const meta = bufs.map((b) => { offsets.push(off); const m = { o: off, l: b.bytes.byteLength }; off = align8(off + b.bytes.byteLength); return m; });
  // trailer: buffer table as JSON appended after data, its length in last 4 bytes
  const table = new TextEncoder().encode(JSON.stringify(meta));
  const out = new Uint8Array(off + table.byteLength + 4);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, MAGIC, true);
  dv.setUint32(4, header.byteLength, true);
  out.set(header, 8);
  bufs.forEach((b, i) => out.set(b.bytes, offsets[i]));
  out.set(table, off);
  dv.setUint32(out.byteLength - 4, table.byteLength, true);
  return out;
}

export function decodeBinJson<T = unknown>(bytes: Uint8Array): T {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (dv.getUint32(0, true) !== MAGIC) throw new Error('Not an AML binary-JSON blob');
  const dec = new TextDecoder();
  const hl = dv.getUint32(4, true);
  const tl = dv.getUint32(bytes.byteLength - 4, true);
  const meta = JSON.parse(dec.decode(bytes.subarray(bytes.byteLength - 4 - tl, bytes.byteLength - 4))) as { o: number; l: number }[];
  return JSON.parse(dec.decode(bytes.subarray(8, 8 + hl)), (_k, v) => {
    if (v && typeof v === 'object' && typeof v.$bin === 'number' && v.type in CTORS) {
      const m = meta[v.$bin];
      const copy = bytes.slice(m.o, m.o + m.l).buffer;
      const C = CTORS[v.type as TAName];
      return new C(copy, 0, m.l / C.BYTES_PER_ELEMENT);
    }
    return v;
  }) as T;
}
