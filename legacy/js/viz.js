// 30_viz.js
(function(){
  const AML = window.AML;

  AML.renderConfusionMatrix = function (canvasId, cm, labels) {
    if (AML.state.chartInstances[canvasId]) AML.state.chartInstances[canvasId].destroy();
    const el = document.getElementById(canvasId);
    if (!el) return;
    const ctx = el.getContext('2d');
  
    // === Distinct, colorblind-friendly palette ===
    const BASE_PALETTE = [
      '#4E79A7', '#F28E2B', '#59A14F', '#E15759', '#76B7B2',
      '#EDC948', '#B07AA1', '#FF9DA7', '#9C755F', '#BAB0AC'
    ];
    function hexToRgb(hex){ const h=hex.replace('#',''); return [parseInt(h.slice(0,2),16), parseInt(h.slice(2,4),16), parseInt(h.slice(4,6),16)]; }
    function rgba(hex, a=0.9){ const [r,g,b]=hexToRgb(hex); return `rgba(${r},${g},${b},${a})`; }
    function hslColor(i, n){ const hue = Math.round((360 * i) / Math.max(1,n)); return `hsl(${hue} 70% 50%)`; }
    function pickColor(i, n){
      return i < BASE_PALETTE.length ? BASE_PALETTE[i] : hslColor(i, n);
    }
  
    const data = {
      labels: labels.map(l => `Pred: ${l}`),
      datasets: labels.map((rowLabel, rowIndex) => {
        const base = pickColor(rowIndex, labels.length);
        const row = cm[rowIndex];
        return {
          label: `True: ${rowLabel}`,
          data: row,
          // 固定整列顏色，確保每個類別顏色都不同
          backgroundColor: row.map(() => rgba(base, 0.9)),
          borderColor: row.map(() => rgba(base, 1)),
          borderWidth: (ctx) => (ctx.dataIndex === ctx.datasetIndex ? 2 : 1), // 對角線稍加粗，容易辨識
          hoverBackgroundColor: row.map(() => rgba(base, 1)),
          hoverBorderWidth: 2
        };
      })
    };
  
    AML.state.chartInstances[canvasId] = new Chart(ctx, {
      type: 'bar',
      data,
      options: {
        responsive: true,
        plugins: {
          legend: { position: 'top' },
          title: { display: true, text: 'Confusion Matrix' },
          tooltip: {
            callbacks: {
              label: (context) => {
                const trueLabel = context.dataset.label.replace('True: ', '');
                const predLabel = context.label.replace('Pred: ', '');
                const count = context.parsed.y;
                const rowSum = cm[context.datasetIndex].reduce((s,v)=>s+v,0) || 1;
                const pct = ((count / rowSum) * 100).toFixed(1);
                return `True: ${trueLabel}, Pred: ${predLabel} = ${count} (${pct}%)`;
              }
            }
          }
        },
        scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true } }
      }
    });
  };
  

  AML.renderMetricsTable = function(elId, metrics){
    const el = document.getElementById(elId);
    let html = `<h5>Performance Report</h5>`;
    html += `<p>Accuracy: ${(metrics.accuracy * 100).toFixed(2)}%</p>`;
    html += `<table border="1" cellpadding="5" cellspacing="0"><tr><th>Class</th><th>Precision</th><th>Recall</th><th>F1</th></tr>`;
    for (const cls in metrics.perClass){
      const { precision, recall, f1 } = metrics.perClass[cls];
      html += `<tr><td>${cls}</td><td>${(precision*100).toFixed(2)}%</td><td>${(recall*100).toFixed(2)}%</td><td>${(f1*100).toFixed(2)}%</td></tr>`;
    }
    html += `</table>`;
    el.innerHTML = html;
  };

  AML.renderROC = function(canvasId, fpr, tpr, auc){
    if (AML.state.chartInstances[canvasId]) AML.state.chartInstances[canvasId].destroy();
    const ctx = document.getElementById(canvasId).getContext('2d');
    AML.state.chartInstances[canvasId] = new Chart(ctx, {
      type: 'line',
      data: {
        labels: fpr,
        datasets: [{ label: `ROC Curve (AUC = ${auc.toFixed(3)})`, data: fpr.map((x,i)=>({x, y:tpr[i]})), borderColor:'#e67e22', fill:false }]
      },
      options: {
        responsive: true,
        scales: {
          x: { type: 'linear', min: 0, max: 1, title: { display: true, text: 'False Positive Rate' } },
          y: { min: 0, max: 1, title: { display: true, text: 'True Positive Rate' } }
        }
      }
    });
  };

  AML.getModelSummaryText = function(model){
    const lines = [];
    lines.push(`📦 Model: ${model.name || 'Unnamed Model'}`);
    lines.push('──────────────────────────────────────────────────────────────────────────');
    lines.push(` No  | Layer Name         | Type       | Output Shape     | Params | Activation`);
    lines.push('──────────────────────────────────────────────────────────────────────────');
    
    model.layers.forEach((layer, i) => {
      const name = layer?.name || `layer_${i}`;
      const className = typeof layer.getClassName === 'function' 
        ? layer.getClassName() 
        : (layer?.className || 'Unknown');
      const outputShape = JSON.stringify(layer?.outputShape || '—');
      const paramCount = layer?.countParams?.() || 0;
  
      // 取得 activation（如果有 config）
      let activation = '';
      if (typeof layer.getConfig === 'function') {
        activation = layer.getConfig()?.activation ?? '';
      }
      if (!activation) activation = 'linear'; // 預設補上 linear
  
      lines.push(
        `${String(i+1).padEnd(4)}| ${name.padEnd(20)} | ${className.padEnd(10)} | ${outputShape.padEnd(16)} | ${String(paramCount).padEnd(6)}| ${activation}`
      );
    });
  
    lines.push('──────────────────────────────────────────────────────────────────────────');
    lines.push(`Total params: ${model.countParams()}`);
    return lines.join('\n');
  };
  
  AML.ensureCharts = function(){
    if (AML.state.chartsInit) return;
    AML.state.chartsInit = True = true;
    AML.state.charts.loss = new Chart(document.getElementById('lossChart'), {
      type: 'line',
      data: { labels: [], datasets: [
        { label: 'Train Loss', data: [], borderColor: '#27ae60', backgroundColor: 'rgba(39,174,96,0.1)' },
        { label: 'Val Loss', data: [], borderColor: '#e74c3c', backgroundColor: 'rgba(231,76,60,0.1)' }
      ]},
      options: { responsive: true, animation: false }
    });
    AML.state.charts.acc = new Chart(document.getElementById('accChart'), {
      type: 'line',
      data: { labels: [], datasets: [{ label: 'Val Accuracy', data: [], borderColor: '#3498db', backgroundColor: 'rgba(52,152,219,.1)' }] },
      options: { responsive: true, animation: false }
    });
    AML.state.charts.lr = new Chart(document.getElementById('lrChart'), {
      type: 'line',
      data: { labels: [], datasets: [{ label: 'Learning Rate', data: [], borderColor: '#8e44ad', backgroundColor: 'rgba(142,68,173,0.1)' }] },
      options: { responsive: true, animation: false }
    });
  };

  AML.resetCharts = function(showAcc){
    AML.ensureCharts();
    const C = AML.state.charts;
    C.loss.data.labels = []; C.loss.data.datasets[0].data = []; C.loss.data.datasets[1].data = []; C.loss.update();
    C.acc.data.labels = [];  C.acc.data.datasets[0].data = [];  C.acc.update();
    C.lr.data.labels = [];   C.lr.data.datasets[0].data = [];   C.lr.update();
    document.getElementById('accChart').style.display = showAcc ? 'block' : 'none';
  };
})();
