// 10_utils.js
(function(){
  const AML = window.AML;
  AML.isNumeric = v => !(v === null || v === undefined || v === '') && !isNaN(parseFloat(v)) && isFinite(v);
  AML.unique = arr => Array.from(new Set(arr));
  AML.toCSV = function(rows){
    if (!rows.length) return '';
    const header = Object.keys(rows[0]);
    const out = [header.join(',')];
    for (const r of rows) out.push(header.map(k => r[k]).join(','));
    return out.join('\n');
  };
  AML.downloadBlob = function(filename, content, mime='text/plain'){
    const blob = new Blob([content], {type:mime});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  AML.renderTable = function(elId, rows){
    const el = document.getElementById(elId);
    if (!rows.length){ el.innerHTML = '<div class="muted">無資料</div>'; return; }
    const cols = Object.keys(rows[0]);
    const head = '<tr>' + cols.map(c => `<th>${c}</th>`).join('') + '</tr>';
    const body = rows.map(r => '<tr>' + cols.map(c => `<td>${r[c]}</td>`).join('') + '</tr>').join('');
    el.innerHTML = `<table><thead>${head}</thead><tbody>${body}</tbody></table>`;
  };
  AML.safeStringify = function(obj){
    const seen = new WeakSet();
    return JSON.stringify(obj, (key, value) => {
      if (typeof value === 'function') return undefined;
      if (typeof value === 'object' && value !== null){
        if (seen.has(value)) return undefined;
        seen.add(value);
      }
      return value;
    }, 2);
  };
  AML.logAutoInfo = function(text){
    const el = document.getElementById('autoLog');
    if (el) el.textContent += text + '\n';
  };
})();
