/* AML portable runtime — dependency-free model evaluation for exported predictors.
 * Embedded verbatim into single-file HTML predictors (export keywords stripped) and
 * imported by the workbench to verify exports. Keep it ES2017 and self-contained. */

export function amlHash(str) {
  var h = 0x811c9dc5;
  for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h >>> 0;
}

function amlNum(v) {
  if (v === null || v === undefined) return NaN;
  if (typeof v === 'number') return v;
  var s = String(v).trim().replace(/,/g, '');
  if (s === '' || /^(NA|N\/A|NaN|nan|NULL|null|None|none|#N\/A|\?)$/.test(s)) return NaN;
  var x = Number(s);
  return isFinite(x) ? x : NaN;
}

function amlStr(v) {
  if (v === null || v === undefined) return null;
  var s = String(v).trim();
  return s === '' || /^(NA|N\/A|NaN|nan|NULL|null|None|none|#N\/A|\?)$/.test(s) ? null : s;
}

function amlTokens(text) {
  var out = [], re = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]+|[\p{L}\p{N}]{2,}/gu, m;
  text = text.toLowerCase();
  while ((m = re.exec(text))) {
    var w = m[0];
    if (/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u.test(w)) {
      if (w.length === 1) out.push(w);
      for (var i = 0; i + 1 < w.length; i++) out.push(w.slice(i, i + 2));
    } else out.push(w);
  }
  return out;
}

/** Replay a fitted PreprocessorState on one raw row ({ column: value }). */
export function amlTransform(prep, row) {
  var out = [];
  for (var si = 0; si < prep.steps.length; si++) {
    var s = prep.steps[si], raw = row[s.column];
    if (s.type === 'numeric') {
      var v = amlNum(raw), miss = isNaN(v);
      out.push(((miss ? s.fill : v) - s.center) / s.scale);
      if (s.indicator) out.push(miss ? 1 : 0);
    } else if (s.type === 'onehot') {
      var key = amlStr(raw); if (key === null) key = '__missing__';
      var k = s.categories.indexOf(key);
      for (var c = 0; c < s.categories.length; c++) out.push(c === k ? 1 : 0);
      if (s.other) out.push(k < 0 ? 1 : 0);
    } else if (s.type === 'ordinal') {
      var ko = amlStr(raw); if (ko === null) ko = '__missing__';
      var idx = s.categories.indexOf(ko);
      out.push(idx < 0 ? -1 : idx / Math.max(1, s.categories.length - 1));
    } else if (s.type === 'hash') {
      var kh = amlStr(raw); if (kh === null) kh = '__missing__';
      var b = amlHash(kh) % s.buckets;
      for (var j = 0; j < s.buckets; j++) out.push(j === b ? 1 : 0);
    } else if (s.type === 'target') {
      var kt = amlStr(raw); if (kt === null) kt = '__missing__';
      var te = s.table[kt] || s.prior;
      for (var q = 0; q < s.outputs; q++) out.push(te[q]);
    } else if (s.type === 'tfidf') {
      var vec = s.vocab.map(function () { return 0; }), txt = amlStr(raw);
      if (txt !== null) {
        amlTokens(txt).forEach(function (tok) { var ix = s.vocab.indexOf(tok); if (ix >= 0) vec[ix] += s.idf[ix]; });
        var nn = Math.sqrt(vec.reduce(function (a, v) { return a + v * v; }, 0));
        if (nn > 0) vec = vec.map(function (v) { return v / nn; });
      }
      for (var vi = 0; vi < vec.length; vi++) out.push(vec[vi]);
    } else if (s.type === 'datetime') {
      var ds = amlStr(raw), t = ds === null ? NaN : Date.parse(ds.replace(/\//g, '-'));
      var d = new Date(t), parts = isNaN(t) ? null : [d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate(), d.getUTCDay()];
      for (var p = 0; p < s.parts.length; p++) out.push(((parts ? parts[p] : s.fill[p]) - s.center[p]) / s.scale[p]);
    }
  }
  return out;
}

function amlLeaf(tree, x, rule) {
  var i = 0;
  for (var guard = 0; guard < 100000; guard++) {
    var leaf = tree.leaf ? tree.leaf[i] : tree.left[i] === -1;
    if (leaf) return tree.value[i];
    var f = tree.feature[i], v = x[f];
    // XGBoost compares float32(feature) < float32(threshold)
    i = (rule === 'lt' ? Math.fround(v) < Math.fround(tree.threshold[i]) : v <= tree.threshold[i]) ? tree.left[i] : tree.right[i];
  }
  throw new Error('tree walk did not terminate');
}

function amlSoftmax(z) {
  var m = Math.max.apply(null, z), e = z.map(function (v) { return Math.exp(v - m); }), s = e.reduce(function (a, b) { return a + b; }, 0);
  return e.map(function (v) { return v / s; });
}
function amlSigmoid(z) { return 1 / (1 + Math.exp(-z)); }

/** Evaluate one model on an encoded row. Returns class probabilities (array) or a regression value (number, model space). */
export function amlEvalModel(m, x, nClasses) {
  var k, i, z, out;
  if (m.kind === 'linear') {
    k = m.b.length; z = m.b.slice();
    for (var c = 0; c < k; c++) for (var j = 0; j < x.length; j++) z[c] += x[j] * m.W[j][c];
    if (!m.classifier) return z[0];
    out = k === 1 ? [1 - amlSigmoid(z[0]), amlSigmoid(z[0])] : amlSoftmax(z);
    return amlPlace(out, m.classes, nClasses);
  }
  if (m.kind === 'mlp') {
    var h = x;
    for (var L = 0; L < m.layers.length; L++) {
      var ly = m.layers[L], o = ly.b.slice();
      for (var a = 0; a < o.length; a++) for (var bi = 0; bi < h.length; bi++) o[a] += h[bi] * ly.W[bi][a];
      if (ly.activation === 'relu') o = o.map(function (v) { return v > 0 ? v : 0; });
      else if (ly.activation === 'elu') o = o.map(function (v) { return v > 0 ? v : Math.exp(v) - 1; });
      else if (ly.activation === 'tanh') o = o.map(Math.tanh);
      else if (ly.activation === 'sigmoid') o = o.map(amlSigmoid);
      else if (ly.activation === 'softmax') o = amlSoftmax(o);
      h = o;
    }
    return nClasses ? h : h[0];
  }
  if (m.kind === 'forest') {
    var acc = null;
    for (i = 0; i < m.trees.length; i++) {
      var val = amlLeaf(m.trees[i], x, 'le');
      if (!acc) acc = val.map(function () { return 0; });
      for (var q = 0; q < val.length; q++) acc[q] += val[q] / m.trees.length;
    }
    return m.classifier ? amlPlace(acc, m.classes, nClasses) : acc[0];
  }
  // boosted trees: xgboost / lightgbm / hgb
  var per = m.kind === 'hgb' ? (m.baseline.length) : (m.classifier && m.classes.length > 2 ? m.classes.length : 1);
  var margin = [];
  for (i = 0; i < per; i++) margin.push(0);
  if (m.kind === 'hgb') for (i = 0; i < per; i++) margin[i] = m.baseline[i];
  var nTrees = m.trees.length;
  if (m.bestIteration !== null && m.bestIteration !== undefined) nTrees = Math.min(nTrees, (m.bestIteration + (m.kind === 'xgboost' ? 1 : 0)) * per);
  for (i = 0; i < nTrees; i++) margin[m.treeClass[i] % per] += amlLeaf(m.trees[i], x, m.kind === 'xgboost' ? 'lt' : 'le')[0];
  if (m.kind === 'xgboost') {
    var bsv = [].concat(m.baseScore), logistic = /logistic/.test(m.objective);
    for (i = 0; i < per; i++) { var bs = bsv.length === per ? bsv[i] : bsv[0]; margin[i] += logistic ? Math.log(bs / (1 - bs)) : bs; }
  }
  if (!m.classifier) return margin[0];
  out = per === 1 ? [1 - amlSigmoid(margin[0]), amlSigmoid(margin[0])] : amlSoftmax(margin);
  return amlPlace(out, m.classes, nClasses);
}

function amlPlace(p, classes, nClasses) {
  if (!classes || !classes.length || !nClasses || classes.length === nClasses) return p;
  var full = []; for (var i = 0; i < nClasses; i++) full.push(0);
  for (var j = 0; j < classes.length; j++) full[classes[j]] = p[j];
  return full;
}

/** Predict one raw row with a portable bundle. */
export function amlPredict(bundle, row) {
  var t = bundle.target, nC = t.classes ? t.classes.length : 0, acc = null;
  for (var i = 0; i < bundle.members.length; i++) {
    var mem = bundle.members[i], x = amlTransform(mem.prep, row), r = amlEvalModel(mem.model, x, nC);
    if (nC) { if (!acc) acc = r.map(function () { return 0; }); for (var c = 0; c < nC; c++) acc[c] += mem.weight * r[c]; }
    else { var scale = mem.targetScale || t; acc = (acc || 0) + mem.weight * (r * scale.std + scale.mean); }
  }
  if (!nC) return { value: acc };
  var best = 0; for (var k = 1; k < nC; k++) if (acc[k] > acc[best]) best = k;
  return { label: t.classes[best], proba: acc };
}
