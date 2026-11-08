/** Dense row-major matrix (transferable between threads). */
export interface Matrix {
  rows: number;
  cols: number;
  data: Float64Array;
}

export function zeros(rows: number, cols: number): Matrix {
  return { rows, cols, data: new Float64Array(rows * cols) };
}

export function rowView(m: Matrix, i: number): Float64Array {
  return m.data.subarray(i * m.cols, (i + 1) * m.cols);
}

export function takeMatrixRows(m: Matrix, idx: ArrayLike<number>): Matrix {
  const out = zeros(idx.length, m.cols);
  for (let i = 0; i < idx.length; i++) out.data.set(rowView(m, idx[i]), i * m.cols);
  return out;
}

export function takeVector<T extends Float64Array | Int32Array>(v: T, idx: ArrayLike<number>): T {
  const out = new (v.constructor as { new (n: number): T })(idx.length);
  for (let i = 0; i < idx.length; i++) out[i] = v[idx[i]];
  return out;
}

export function argmaxRow(m: Matrix, i: number): number {
  let best = 0, bv = -Infinity;
  for (let j = 0; j < m.cols; j++) {
    const v = m.data[i * m.cols + j];
    if (v > bv) { bv = v; best = j; }
  }
  return best;
}
