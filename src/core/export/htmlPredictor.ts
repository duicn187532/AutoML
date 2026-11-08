import { escapeHtml, jsonForScript } from '../security/escape';
import runtimeSource from './runtime.js?raw';
import type { PortableBundle } from '../workers/tasks/exportPortable';

/**
 * Single-file HTML predictor: the portable model, its preprocessing and a ~4 KB runtime inlined
 * into one page with a single-row form and batch CSV scoring. Works offline, no dependencies.
 * Every user / data string is escaped (HTML) or set via textContent (runtime).
 */
export function htmlPredictor(bundle: PortableBundle, title: string, card?: string): string {
  const runtime = runtimeSource.replace(/^export /gm, '');
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>
body{font-family:system-ui,-apple-system,'Segoe UI','Noto Sans TC',sans-serif;margin:0;background:#f5f6f8;color:#1c2330}
main{max-width:960px;margin:0 auto;padding:24px}.card{background:#fff;border:1px solid #e3e6eb;border-radius:8px;padding:16px;margin-bottom:16px}
h1{font-size:20px}label{display:flex;flex-direction:column;font-size:13px;font-weight:600;gap:4px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px}
input,select,button{font:inherit;padding:6px 8px;border:1px solid #cbd5e1;border-radius:6px}button{background:#1d4ed8;color:#fff;border-color:#1d4ed8;cursor:pointer}
#out{font-size:18px;font-weight:700;margin-top:12px}table{border-collapse:collapse;font-size:12px}td,th{border-bottom:1px solid #e3e6eb;padding:3px 8px;text-align:left}
pre{white-space:pre-wrap;font-size:12px}.muted{color:#6b7280;font-size:12px}
</style></head><body><main>
<h1>${escapeHtml(title)}</h1>
<p class="muted">Offline predictor exported from AutoML Workbench · target: ${escapeHtml(bundle.target.column)} · ${bundle.members.length} model(s)</p>
<div class="card"><h2>Single prediction</h2><form id="f" class="grid"></form><p><button type="button" id="go">Predict</button></p><div id="out"></div><div id="proba" class="muted"></div></div>
<div class="card"><h2>Batch (CSV)</h2><input type="file" id="csv" accept=".csv,text/csv"> <button type="button" id="dl" disabled>Download predictions</button><p id="bstat" class="muted"></p><div id="prev"></div></div>
${card ? `<div class="card"><h2>Model card</h2><pre>${escapeHtml(card)}</pre></div>` : ''}
</main>
<script>
var BUNDLE = ${jsonForScript(bundle)};
${runtime}
(function () {
  var f = document.getElementById('f');
  BUNDLE.features.forEach(function (feat) {
    var l = document.createElement('label'); l.textContent = feat.name;
    var el;
    if (feat.kind === 'categorical' && feat.categories) {
      el = document.createElement('select');
      ['', ].concat(feat.categories).forEach(function (c) { var o = document.createElement('option'); o.value = c; o.textContent = c === '' ? '(missing)' : c; el.appendChild(o); });
    } else { el = document.createElement('input'); el.type = feat.kind === 'numeric' ? 'number' : 'text'; el.step = 'any'; }
    el.name = feat.name; l.appendChild(el); f.appendChild(l);
  });
  function show(r) {
    var out = document.getElementById('out'), pr = document.getElementById('proba');
    if (r.label !== undefined) {
      out.textContent = BUNDLE.target.column + ' = ' + r.label;
      pr.textContent = BUNDLE.target.classes.map(function (c, i) { return c + ': ' + (r.proba[i] * 100).toFixed(1) + '%'; }).join('  ·  ');
    } else { out.textContent = BUNDLE.target.column + ' = ' + r.value.toFixed(4); pr.textContent = ''; }
  }
  document.getElementById('go').onclick = function () {
    var row = {}; new FormData(f).forEach(function (v, k) { row[k] = v; });
    try { show(amlPredict(BUNDLE, row)); } catch (e) { document.getElementById('out').textContent = 'Error: ' + e.message; }
  };
  function parseCsv(text) {
    var rows = [], row = [], cell = '', q = false;
    text = text.replace(/^\\ufeff/, '');
    for (var i = 0; i < text.length; i++) {
      var ch = text[i];
      if (q) { if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += ch; }
      else if (ch === '"') q = true; else if (ch === ',') { row.push(cell); cell = ''; }
      else if (ch === '\\n' || ch === '\\r') { if (ch === '\\r' && text[i + 1] === '\\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
      else cell += ch;
    }
    if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
    return rows.filter(function (r) { return r.length > 1 || r[0] !== ''; });
  }
  function csvCell(v) {
    var s = v === null || v === undefined ? '' : String(v);
    if (/^[=+\\-@\\t\\r]/.test(s) && !/^[-+]?\\d*\\.?\\d+(e[-+]?\\d+)?$/i.test(s)) s = "'" + s;
    return /[",\\n\\r]|^\\s|\\s$/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }
  var result = null;
  document.getElementById('csv').onchange = function (e) {
    var file = e.target.files[0]; if (!file) return;
    file.text().then(function (text) {
      var rows = parseCsv(text), header = rows.shift();
      var cls = BUNDLE.target.classes;
      var outHeader = header.concat([BUNDLE.target.column + '_pred']).concat(cls ? cls.map(function (c) { return 'p(' + c + ')'; }) : []);
      var out = rows.map(function (r) {
        var row = {}; header.forEach(function (h, i) { row[h] = r[i]; });
        var p = amlPredict(BUNDLE, row);
        return r.concat(cls ? [p.label].concat(p.proba.map(function (x) { return x.toFixed(6); })) : [p.value]);
      });
      result = [outHeader].concat(out);
      document.getElementById('bstat').textContent = out.length + ' rows scored';
      document.getElementById('dl').disabled = false;
      var t = document.createElement('table');
      result.slice(0, 11).forEach(function (r, i) { var tr = document.createElement('tr'); r.forEach(function (c) { var td = document.createElement(i ? 'td' : 'th'); td.textContent = c; tr.appendChild(td); }); t.appendChild(tr); });
      var prev = document.getElementById('prev'); prev.textContent = ''; prev.appendChild(t);
    });
  };
  document.getElementById('dl').onclick = function () {
    var text = '\\ufeff' + result.map(function (r) { return r.map(csvCell).join(','); }).join('\\r\\n') + '\\r\\n';
    var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: 'text/csv' })); a.download = 'predictions.csv'; a.click();
  };
})();
</script></body></html>
`;
}
