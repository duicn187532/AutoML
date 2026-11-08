/**
 * Caruana et al. (2004) ensemble selection: greedy forward selection WITH replacement over
 * out-of-fold predictions, minimising log loss (classification) or RMSE (regression).
 * Weights are selection counts / iterations.
 */
export interface OofPrediction {
  /** classification: rows × k probabilities (row-major); regression: rows predictions */
  data: Float64Array;
  cols: number;
}

function loss(pred: Float64Array, y: ArrayLike<number>, cols: number, classification: boolean): number {
  let s = 0;
  if (classification) {
    for (let i = 0; i < y.length; i++) s -= Math.log(Math.max(1e-15, pred[i * cols + y[i]]));
  } else {
    for (let i = 0; i < y.length; i++) s += (pred[i] - y[i]) ** 2;
    return Math.sqrt(s / y.length);
  }
  return s / y.length;
}

export function caruanaSelection(members: OofPrediction[], y: ArrayLike<number>, classification: boolean, iterations = 30): { weights: number[]; loss: number; history: number[] } {
  if (!members.length) throw new Error('no ensemble members');
  const cols = members[0].cols;
  const n = members[0].data.length;
  const sum = new Float64Array(n);
  const counts = new Array<number>(members.length).fill(0);
  const history: number[] = [];
  let best = Infinity;
  const trial = new Float64Array(n);
  for (let it = 1; it <= iterations; it++) {
    let bestM = -1, bestL = Infinity;
    for (let m = 0; m < members.length; m++) {
      const d = members[m].data;
      for (let i = 0; i < n; i++) trial[i] = (sum[i] + d[i]) / it;
      const l = loss(trial, y, cols, classification);
      if (l < bestL - 1e-12) { bestL = l; bestM = m; }
    }
    counts[bestM]++;
    const d = members[bestM].data;
    for (let i = 0; i < n; i++) sum[i] += d[i];
    history.push(bestL);
    best = Math.min(best, bestL);
  }
  const total = counts.reduce((a, b) => a + b, 0);
  return { weights: counts.map((c) => c / total), loss: history[history.length - 1], history };
}

export function blend(members: OofPrediction[], weights: number[]): OofPrediction {
  const out = new Float64Array(members[0].data.length);
  members.forEach((m, k) => { if (weights[k]) for (let i = 0; i < out.length; i++) out[i] += weights[k] * m.data[i]; });
  return { data: out, cols: members[0].cols };
}
