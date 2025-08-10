/* ========= 全域狀態 ========= */
let rawData = [], columns = [];
let meta = null;                // 前處理與任務資訊
let tfModel = null;             // TF.js 模型（或 null）
let traditionalModel = null;    // MLBundle 傳統模型（或 null）
let lastPredRows = [];
let chartInstances = {};
let customLayers = [];
const CUSTOM_ALLOWED = ['mlp', 'deepmlp', 'mlp_bn'];
const ML_MODEL_MAP = {
  tree: { cls: 'DecisionTreeClassifier', reg: 'DecisionTreeRegression' },
  rf: { cls: 'RandomForestClassifier', reg: 'RandomForestRegression' },
  knn: { cls: 'KNN', reg: 'KNN' },
  svm: { cls: 'SVM', reg: 'SVM' },
  nb: { cls: 'NaiveBayes', reg: null }, // NB 無回歸
};
const AUTO_MODEL_CANDIDATES = {
  classification: ['mlp', 'deepmlp', 'logistic'],
  regression: ['linear', 'poly', 'mlp']
};

/* ========= 小工具 ========= */
const isNumeric = v => !(v === null || v === undefined || v === '') && !isNaN(parseFloat(v)) && isFinite(v);
const unique = arr => Array.from(new Set(arr));
function toCSV(rows) { if (!rows.length) return ''; const header = Object.keys(rows[0]); const out = [header.join(',')]; for (const r of rows) out.push(header.map(k => r[k]).join(',')); return out.join('\n'); }
function downloadBlob(filename, content, mime = 'text/plain') { const blob = new Blob([content], { type: mime }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename; a.click(); URL.revokeObjectURL(a.href); }
function renderTable(elId, rows) { const el = document.getElementById(elId); if (!rows.length) { el.innerHTML = '<div class="muted">無資料</div>'; return; } const cols = Object.keys(rows[0]); const head = '<tr>' + cols.map(c => `<th>${c}</th>`).join('') + '</tr>'; const body = rows.map(r => '<tr>' + cols.map(c => `<td>${r[c]}</td>`).join('') + '</tr>').join(''); el.innerHTML = `<table><thead>${head}</thead><tbody>${body}</tbody></table>`; }
function safeStringify(obj) {
  const seen = new WeakSet();
  return JSON.stringify(obj, (key, value) => {
    if (typeof value === 'function') return undefined; // 移除函式
    if (typeof value === 'object' && value !== null) {
      if (seen.has(value)) return undefined;           // 移除循環
      seen.add(value);
    }
    return value;
  }, 2);
}
function calcClassificationMetrics(yTrue, yPred, labels) {
  const results = {};
  labels.forEach(label => {
    const tp = yTrue.filter((y, i) => y === label && yPred[i] === label).length;
    const fp = yTrue.filter((y, i) => y !== label && yPred[i] === label).length;
    const fn = yTrue.filter((y, i) => y === label && yPred[i] !== label).length;
    const precision = tp / (tp + fp || 1);
    const recall = tp / (tp + fn || 1);
    const f1 = 2 * (precision * recall) / ((precision + recall) || 1);
    results[label] = { precision, recall, f1 };
  });
  const accuracy = yTrue.filter((y, i) => y === yPred[i]).length / yTrue.length;
  return { accuracy, perClass: results };
}

function calcROC(yTrue, yScores) {
  const thresholds = [...new Set(yScores)].sort((a, b) => b - a);
  const tpr = [], fpr = [];
  thresholds.forEach(th => {
    const tp = yTrue.filter((y, i) => y === 1 && yScores[i] >= th).length;
    const fp = yTrue.filter((y, i) => y === 0 && yScores[i] >= th).length;
    const fn = yTrue.filter((y, i) => y === 1 && yScores[i] < th).length;
    const tn = yTrue.filter((y, i) => y === 0 && yScores[i] < th).length;
    tpr.push(tp / (tp + fn || 1));
    fpr.push(fp / (fp + tn || 1));
  });
  const auc = tpr.reduce((sum, t, i) => sum + (i > 0 ? (t + tpr[i - 1]) * (fpr[i] - fpr[i - 1]) / 2 : 0), 0);
  return { fpr, tpr, auc };
}
function renderConfusionMatrix(canvasId, cm, labels) {

  if (chartInstances[canvasId]) {
    chartInstances[canvasId].destroy();
  }
  const ctx = document.getElementById(canvasId).getContext('2d');

  const data = {
    labels: labels.map(l => `Pred: ${l}`),
    datasets: labels.map((rowLabel, rowIndex) => ({
      label: `True: ${rowLabel}`,
      data: cm[rowIndex],
      backgroundColor: cm[rowIndex].map(v => {
        const maxVal = Math.max(...cm.flat());
        const intensity = v === 0 ? 0 : v / maxVal;
        const r = Math.floor(255 * intensity);         // 0 → 255
        const g = Math.floor(255 * intensity);         // 0 → 255
        const b = Math.floor(255 * (1 - intensity));   // 255 → 0
        return `rgb(${r},${g},${b})`; // 深藍 → 黃
      })
    }))
  };

  chartInstances[canvasId] = new Chart(ctx, {
    type: 'bar',
    data: data,
    options: {
      responsive: true,
      plugins: {
        legend: { position: 'top' },
        title: {
          display: true,
          text: 'Confusion Matrix'
        },
        tooltip: {
          callbacks: {
            label: function (context) {
              const trueLabel = context.dataset.label.replace('True: ', '');
              const predLabel = context.label.replace('Pred: ', '');
              const count = context.parsed.y;
              return `True: ${trueLabel}, Pred: ${predLabel} = ${count}`;
            }
          }
        }
      },
      scales: {
        x: { stacked: true },
        y: { stacked: true, beginAtZero: true }
      }
    }
  });
}
function renderMetricsTable(elId, metrics) {

  const el = document.getElementById(elId);
  let html = `<h5>Performance Report</h5>`;
  html += `<p>Accuracy: ${(metrics.accuracy * 100).toFixed(2)}%</p>`;
  html += `<table border="1" cellpadding="5" cellspacing="0">
      <tr><th>Class</th><th>Precision</th><th>Recall</th><th>F1</th></tr>`;
  for (const cls in metrics.perClass) {
    const { precision, recall, f1 } = metrics.perClass[cls];
    html += `<tr>
        <td>${cls}</td>
        <td>${(precision * 100).toFixed(2)}%</td>
        <td>${(recall * 100).toFixed(2)}%</td>
        <td>${(f1 * 100).toFixed(2)}%</td>
      </tr>`;
  }
  html += `</table>`;
  el.innerHTML = html;
}
function renderROC(canvasId, fpr, tpr, auc) {
  // 如果舊圖表存在 → 先 destroy
  if (chartInstances[canvasId]) {
    chartInstances[canvasId].destroy();
  }

  const ctx = document.getElementById(canvasId).getContext('2d');
  chartInstances[canvasId] = new Chart(ctx, {
    type: 'line',
    data: {
      labels: fpr,
      datasets: [{
        label: `ROC Curve (AUC = ${auc.toFixed(3)})`,
        data: fpr.map((x, i) => ({ x, y: tpr[i] })),
        borderColor: '#e67e22',
        fill: false
      }]
    },
    options: {
      responsive: true,
      scales: {
        x: { type: 'linear', min: 0, max: 1, title: { display: true, text: 'False Positive Rate' } },
        y: { min: 0, max: 1, title: { display: true, text: 'True Positive Rate' } }
      }
    }
  });
}
function getModelSummaryText(model) {
  const lines = [];
  lines.push(`📦 Model: ${model.name || 'Unnamed Model'}`);
  lines.push('────────────────────────────────────────────────────────────');
  lines.push(` No  | Layer Name         | Type       | Output Shape     | Params`);
  lines.push('────────────────────────────────────────────────────────────');

  model.layers.forEach((layer, i) => {
    const name = layer?.name || `layer_${i}`;
    const className = typeof layer.getClassName === 'function'
      ? layer.getClassName()
      : (layer?.className || 'Unknown');
    const outputShape = JSON.stringify(layer?.outputShape || '—');
    const paramCount = layer?.countParams?.() || 0;

    lines.push(
      `${String(i + 1).padEnd(4)}| ${name.padEnd(20)} | ${className.padEnd(10)} | ${outputShape.padEnd(16)} | ${paramCount}`
    );
  });

  lines.push('────────────────────────────────────────────────────────────');
  lines.push(`Total params: ${model.countParams()}`);
  return lines.join('\n');
}

function addLayerFromUI() {
  const type = document.getElementById('layerTypeSelect').value;
  addLayer(type); // 加入指定類型的層
}

function logAutoInfo(text) {
  const el = document.getElementById('autoLog');
  el.textContent += text + '\n';
}

/* ========= 分頁 ========= */
document.addEventListener('DOMContentLoaded', () => {
  const tabs = document.querySelectorAll('.tab');
  const views = {
    data: document.getElementById('tab-data'),
    config: document.getElementById('tab-config'),
    train: document.getElementById('tab-train'),
    predict: document.getElementById('tab-predict'),
    glossary: document.getElementById('tab-glossary')
  };
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active')); tab.classList.add('active');
      const key = tab.getAttribute('data-tab');
      Object.entries(views).forEach(([k, el]) => el.classList.toggle('hidden', k !== key));
    });
  });
});

/* ========= 前處理 ========= */
function buildPreprocessorCustom(data, target, featureCols, colTypes, normalize = true) {
  const catMaps = {}, numStats = {};
  for (const c of featureCols.filter(c => colTypes[c] === 'numeric')) {
    const vec = data.map(r => { const v = parseFloat(r[c]); return isFinite(v) ? v : 0; });
    const mn = Math.min(...vec), mx = Math.max(...vec);
    const range = (mx - mn) || 1;
    const mean = vec.reduce((a, b) => a + b, 0) / vec.length;
    const std = Math.sqrt(vec.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / vec.length) || 1;
    numStats[c] = { min: mn, max: mx, range, mean, std };
  }
  for (const c of featureCols.filter(c => colTypes[c] === 'category')) {
    const cats = unique(data.map(r => r[c] ?? ''));
    catMaps[c] = {}; cats.forEach((v, i) => catMaps[c][v] = i);
  }
  return { featureCols, colTypes, catMaps, numStats, normalize };
}
function transformFeatures(data, metaPrep) {
  const { featureCols, colTypes, catMaps, numStats, normalize } = metaPrep;
  const out = [];
  for (const r of data) {
    let row = [];
    for (const c of featureCols) {
      if (colTypes[c] === 'numeric') {
        let v = parseFloat(r[c]); if (!isFinite(v)) v = 0;
        if (normalize) { const { min, range } = numStats[c]; v = (v - min) / range; }
        else { const { mean, std } = numStats[c]; v = (v - mean) / std; }
        row.push(v);
      } else {
        const map = catMaps[c], dim = Object.keys(map).length;
        const vec = new Array(dim).fill(0), idx = map[r[c]];
        if (idx !== undefined) vec[idx] = 1;
        row = row.concat(vec);
      }
    }
    out.push(row);
  }
  return out;
}
function inferTaskFromY(yRaw) {
  const numy = yRaw.filter(isNumeric).length, uniq = unique(yRaw);
  if (numy < yRaw.length || uniq.length <= Math.min(20, yRaw.length / 5)) return 'classification';
  return 'regression';
}
function buildLabelMapping(yRaw) {
  const isAllNum = yRaw.every(isNumeric); const uniq = unique(yRaw);
  if (!isAllNum || uniq.length <= Math.min(20, yRaw.length / 5)) { const map = {}; uniq.forEach((v, i) => map[v] = i); return { task: 'classification', map, classes: uniq }; }
  return { task: 'regression' };
}
function prepareXY(data, target, normalize) {
  const yRaw = data.map(r => r[target]);
  // 讀欄位設定（原樣）
  const rows = [...document.querySelectorAll('#varTable tbody tr')];
  const featureCols = [], colTypes = {};
  rows.forEach(row => {
    const colName = row.cells[0].textContent;
    const typeSel = row.cells[1].querySelector('select').value;
    const useFeat = row.cells[2].querySelector('input').checked;
    if (colName !== target && useFeat) {
      featureCols.push(colName);
      if (typeSel === 'auto') {
        const sample = data.map(r => r[colName]).slice(0, 200);
        const numCount = sample.filter(isNumeric).length;
        colTypes[colName] = (numCount === sample.length) ? 'numeric' : 'category';
      } else colTypes[colName] = typeSel;
    }
  });

  const prep = buildPreprocessorCustom(data, target, featureCols, colTypes, normalize);
  const X = transformFeatures(data, prep);

  let y, labelInfo = null;
  let task = document.getElementById('taskSelect').value;
  if (task === 'auto') task = inferTaskFromY(yRaw);

  if (task === 'classification') {
    labelInfo = buildLabelMapping(yRaw);
    y = yRaw.map(v => labelInfo.map[v]);
    prep.labelInfo = labelInfo;

  } else {
    // 回歸
    y = yRaw.map(v => parseFloat(v));

    const normTarget = !!document.getElementById('normalizeTarget')?.checked;

    // 先清空，避免殘留
    prep.normalizeTarget = false;
    delete prep.yMean;
    delete prep.yStd;

    if (normTarget) {
      const yTensor = tf.tensor1d(y);
      const { mean, variance } = tf.moments(yTensor);
      const yMean = mean.arraySync();
      const yStd  = Math.sqrt(variance.arraySync()) || 1;

      if (Number.isFinite(yStd) && yStd > 0) {
        y = y.map(v => (v - yMean) / yStd);
        prep.normalizeTarget = true;
        prep.yMean = yMean;
        prep.yStd  = yStd;
      }
      yTensor.dispose(); mean.dispose(); variance.dispose();
    }
  }

  return { X, y, meta: { ...prep, targetCol: target, task } };
}

/* ========= TF.js 建模 ========= */
/* =========================
 * Learning Rate Schedules
 * ========================= */

/** 產生一個在每個 epoch 開頭調整學習率的回呼 */
function getLRSchedulerCallback(model, baseLR = 1e-3, scheduleType = 'constant', totalEpochs = 50, options = {}) {
  const stepSize = options.stepSize ?? 10;
  const gamma = options.gamma ?? 0.5;
  const expK = options.expK ?? 0.05;
  let currentLR = baseLR; // 直接存在閉包

  function lrOf(epoch) {
    switch (scheduleType) {
      case 'step_decay': return baseLR * Math.pow(gamma, Math.floor(epoch / stepSize));
      case 'exp_decay': return baseLR * Math.exp(-expK * epoch);
      case 'cosine_decay': return baseLR * 0.5 * (1 + Math.cos(Math.PI * epoch / Math.max(1, totalEpochs)));
      default: return baseLR;
    }
  }

  return {
    onEpochBegin: async (epoch) => {
      currentLR = lrOf(epoch);
      if (model?.optimizer) {
        if (typeof model.optimizer.learningRate === 'number') {
          model.optimizer.learningRate = currentLR;
        } else if (model.optimizer.learningRate?.assign) {
          model.optimizer.learningRate.assign(currentLR);
        } else if (model.optimizer.setLearningRate) {
          model.optimizer.setLearningRate(currentLR);
        }
      }
    },
    getCurrentLR: () => currentLR
  };
}

/** 只負責回傳一個基礎 optimizer（不內建 schedule） */
function getOptimizer(baseLR = 1e-3) {
  return tf.train.adam(baseLR);
}

/* =========================
 * Model Factory
 * ========================= */
document.getElementById("modelSelect").addEventListener("change", function () {
  const selected = this.value;
  const toggle = document.getElementById("customModelToggle");

  // 禁用進階模式切換開關
  if (!CUSTOM_ALLOWED.includes(selected)) {
    toggle.checked = false;
    toggle.disabled = true;
    document.getElementById("customLayersContainer").style.display = "none";
  } else {
    toggle.disabled = false;
  }
});

document.getElementById("customModelToggle").addEventListener("change", function () {
  const enabled = this.checked;
  document.getElementById("customLayersContainer").style.display = enabled ? "block" : "none";
  document.getElementById("modelSelect").disabled = enabled;
  if (!enabled) customLayers = [];
});

// 🧱 新增一層
function addLayer(type = 'dense', config = {}) {
  const idx = customLayers.length;
  const container = document.createElement('div');
  container.classList.add('layer-item');
  container.id = `layer-${idx}`;

  let html = `<strong>Layer ${idx + 1}: ${type}</strong><br/>`;

  if (type === 'dense') {
    html += `
        <label>Units: <input type="number" value="${config.units || 64}" onchange="updateLayer(${idx}, 'units', this.value)"></label>
        <label>Activation:
          <select onchange="updateLayer(${idx}, 'activation', this.value)">
            <option value="relu">relu</option>
            <option value="tanh">tanh</option>
            <option value="sigmoid">sigmoid</option>
            <option value="linear">linear</option>
          </select>
        </label>
      `;
    customLayers.push({ type: 'dense', units: config.units || 64, activation: config.activation || 'relu' });
  }

  else if (type === 'dropout') {
    html += `
        <label>Rate: <input type="number" step="0.05" value="${config.rate || 0.3}" onchange="updateLayer(${idx}, 'rate', this.value)"></label>
      `;
    customLayers.push({ type: 'dropout', rate: config.rate || 0.3 });
  }

  else if (type === 'batchnorm') {
    html += `<span>Batch Normalization（無參數）</span>`;
    customLayers.push({ type: 'batchnorm' });
  }

  else if (type === 'activation') {
    html += `
        <label>Function:
          <select onchange="updateLayer(${idx}, 'activation', this.value)">
            <option value="relu">relu</option>
            <option value="tanh">tanh</option>
            <option value="sigmoid">sigmoid</option>
            <option value="softmax">softmax</option>
          </select>
        </label>
      `;
    customLayers.push({ type: 'activation', activation: config.activation || 'relu' });
  }

  else if (type === 'flatten') {
    html += `<span>Flatten（無參數）</span>`;
    customLayers.push({ type: 'flatten' });
  }

  html += `<button onclick="removeLayer(${idx})">❌</button>`;

  container.innerHTML = html;
  document.getElementById("layerList").appendChild(container);
}

function updateLayer(index, key, value) {
  if (key === 'units') customLayers[index].units = parseInt(value);
  else if (key === 'dropout') customLayers[index].dropout = parseFloat(value);
  else customLayers[index][key] = value;
}

function removeLayer(index) {
  customLayers.splice(index, 1);
  document.getElementById(`layer-${index}`).remove();
}

function makeModel(
  inputDim,
  task,
  modelType,
  nClasses = 2,
  lr = 0.001,
  scheduleType = 'constant',
  epochs = 50,
  // 可選正則化與結構參數
  opts = {
    l2: 0,                // L2 正則化係數（0 表示不啟用）
    dropout: 0.2,         // 預設 dropout
    wideUnitsFactor: 2,   // wide_deep 寬度倍率
    tabnetGateUnits: null // 預留：tabnet-like 可調單元
  }
) {
  const isCls = task === 'classification';
  const binary = isCls && nClasses === 2;

  // build optimizer（學習率當下值；動態調整靠 callback）
  const opt = getOptimizer(lr);

  // 共用工具
  const reg = opts.l2 > 0 ? tf.regularizers.l2({ l2: opts.l2 }) : undefined;
  const model = tf.sequential();
  // output & compile
  const compileForTask = () => {
    if (isCls) {
      model.compile({
        optimizer: opt,
        loss: binary ? 'binaryCrossentropy' : 'sparseCategoricalCrossentropy',
        metrics: ['accuracy']
      });
    } else {
      model.compile({ optimizer: opt, loss: 'meanSquaredError' });
    }
  };
  // ✅ 如果啟用進階模式
  const useCustom = document.getElementById("customModelToggle")?.checked;
  if (useCustom && customLayers.length > 0) {
    customLayers.forEach((layer, index) => {
      const isFirst = index === 0;

      switch (layer.type) {
        case 'dense':
          model.add(tf.layers.dense({
            inputShape: isFirst ? [inputDim] : undefined,
            units: layer.units,
            activation: layer.activation || 'relu',
            kernelRegularizer: reg
          }));
          break;

        case 'dropout':
          model.add(tf.layers.dropout({
            rate: layer.rate ?? 0.3
          }));
          break;

        case 'batchnorm':
          model.add(tf.layers.batchNormalization());
          break;

        case 'activation':
          model.add(tf.layers.activation({
            activation: layer.activation || 'relu'
          }));
          break;

        case 'flatten':
          model.add(tf.layers.flatten());
          break;

        case 'reshape':
          model.add(tf.layers.reshape({
            targetShape: layer.targetShape || [inputDim] // 你可讓使用者輸入 [h,w] 這類
          }));
          break;

        // 可以依需求擴充 CNN、LSTM 等
        default:
          console.warn(`未知層類型：${layer.type}`);
      }
    });
    // 輸出層
    model.add(tf.layers.dense({ units: isCls ? (binary ? 1 : nClasses) : 1, activation: isCls ? (binary ? 'sigmoid' : 'softmax') : 'linear' }));
    model.compile({
      optimizer: opt,
      loss: isCls ? (binary ? 'binaryCrossentropy' : 'sparseCategoricalCrossentropy') : 'meanSquaredError',
      metrics: isCls ? ['accuracy'] : [],
    });
    return model;
  }
  // ===== 基礎模型類型 =====
  // ===== 線性 / 邏輯斯 / 多項式 =====
  if (modelType === 'linear' && !isCls) {
    model.add(tf.layers.dense({ inputShape: [inputDim], units: 1, activation: 'linear', kernelRegularizer: reg }));
    compileForTask();
    return model;
  }

  if (modelType === 'logistic' && isCls) {
    model.add(tf.layers.dense({
      inputShape: [inputDim],
      units: binary ? 1 : nClasses,
      activation: binary ? 'sigmoid' : 'softmax',
      kernelRegularizer: reg
    }));
    compileForTask();
    return model;
  }

  if (modelType === 'poly' && !isCls) {
    model.add(tf.layers.dense({ inputShape: [inputDim], units: Math.max(4, inputDim * 2), activation: 'relu', kernelRegularizer: reg }));
    if (opts.dropout > 0) model.add(tf.layers.dropout({ rate: opts.dropout / 2 }));
    model.add(tf.layers.dense({ units: 1, activation: 'linear', kernelRegularizer: reg }));
    compileForTask();
    return model;
  }

  // ===== 通用積木 =====
  const addBlock = (units, { useBN = false, dropout = 0 } = {}) => {
    model.add(tf.layers.dense({ units, activation: 'relu', kernelRegularizer: reg }));
    if (useBN) model.add(tf.layers.batchNormalization());
    if (dropout > 0) model.add(tf.layers.dropout({ rate: dropout }));
  };

  // ===== LSTM 家族 =====
  if (['rnn', 'lstm'].includes(modelType)) {
    // 📌 RNN/LSTM 需要 3D 輸入
    model.add(tf.layers.reshape({ targetShape: [inputDim, 1], inputShape: [inputDim] }));

    if (modelType === 'rnn') {
      model.add(tf.layers.simpleRNN({ units: 32, activation: 'relu', returnSequences: false }));
    } else if (modelType === 'lstm') {
      model.add(tf.layers.lstm({ units: 32, activation: 'tanh', returnSequences: false }));
    }

    model.add(tf.layers.dense({ units: 16, activation: 'relu' }));
  }

  // ===== MLP 家族 =====
  if (modelType === 'mlp') {
    model.add(tf.layers.dense({ inputShape: [inputDim], units: 64, activation: 'relu', kernelRegularizer: reg }));
    if (opts.dropout > 0) model.add(tf.layers.dropout({ rate: opts.dropout }));
    addBlock(32, { useBN: false, dropout: 0 });
  }

  if (modelType === 'mlp_bn') {
    model.add(tf.layers.dense({ inputShape: [inputDim], units: 64, activation: 'relu', kernelRegularizer: reg }));
    model.add(tf.layers.batchNormalization());
    addBlock(32, { useBN: true, dropout: Math.min(0.1, opts.dropout) });
  }

  if (modelType === 'deepmlp') {
    model.add(tf.layers.dense({ inputShape: [inputDim], units: 128, activation: 'relu', kernelRegularizer: reg }));
    if (opts.dropout > 0) model.add(tf.layers.dropout({ rate: Math.max(opts.dropout, 0.3) }));
    addBlock(64, { useBN: true, dropout: 0.2 });
    addBlock(32, { useBN: false, dropout: 0 });
  }

  // ===== Wide & Deep（以串接近似）=====
  if (modelType === 'wide_deep') {
    const wideUnits = Math.min(256, Math.max(32, Math.floor(inputDim * (opts.wideUnitsFactor ?? 2))));
    // wide：線性投影
    model.add(tf.layers.dense({ inputShape: [inputDim], units: wideUnits, activation: 'linear', kernelRegularizer: reg }));
    // deep：非線性
    addBlock(128, { useBN: true, dropout: 0.1 });
    addBlock(64, { useBN: false, dropout: 0.1 });
  }

  // ===== TabNet-like（簡化）=====
  if (modelType === 'tabnet') {
    model.add(tf.layers.dense({ inputShape: [inputDim], units: inputDim, activation: 'linear', kernelRegularizer: reg }));
    addBlock(64, { useBN: true, dropout: 0.1 });
    addBlock(32, { useBN: false, dropout: 0.1 });
  }

  // 若前面沒命中，fallback 成一個 MLP
  if (model.layers.length === 0) {
    model.add(tf.layers.dense({ inputShape: [inputDim], units: 64, activation: 'relu', kernelRegularizer: reg }));
    if (opts.dropout > 0) model.add(tf.layers.dropout({ rate: opts.dropout }));
  }

  // 輸出層
  if (isCls) {
    model.add(tf.layers.dense({
      units: binary ? 1 : nClasses,
      activation: binary ? 'sigmoid' : 'softmax',
      kernelRegularizer: reg
    }));
  } else {
    model.add(tf.layers.dense({ units: 1, activation: 'linear', kernelRegularizer: reg }));
  }

  compileForTask();
  return model;
}

/* ========= 圖表 ========= */
let chartsInit = false;
const charts = { loss: null, acc: null };
function ensureCharts() {
  if (chartsInit) return;
  chartsInit = true;
  charts.loss = new Chart(document.getElementById('lossChart'), {
    type: 'line',
    data: {
      labels: [],
      datasets: [
        { label: 'Train Loss', data: [], borderColor: '#27ae60', backgroundColor: 'rgba(39,174,96,0.1)' },
        { label: 'Val Loss', data: [], borderColor: '#e74c3c', backgroundColor: 'rgba(231,76,60,0.1)' }
      ]
    },
    options: { responsive: true, animation: false }
  });
  charts.acc = new Chart(document.getElementById('accChart'), { type: 'line', data: { labels: [], datasets: [{ label: 'Val Accuracy', data: [], borderColor: '#3498db', backgroundColor: 'rgba(52,152,219,.1)' }] }, options: { responsive: true, animation: false } });

  charts.lr = new Chart(document.getElementById('lrChart'), {
    type: 'line',
    data: {
      labels: [],
      datasets: [{ label: 'Learning Rate', data: [], borderColor: '#8e44ad', backgroundColor: 'rgba(142,68,173,0.1)' }]
    },
    options: { responsive: true, animation: false }
  });

}
function resetCharts(showAcc) {
  ensureCharts();
  charts.loss.data.labels = [];
  charts.loss.data.datasets[0].data = [];
  charts.loss.data.datasets[1].data = []; // ← 加上這行
  charts.loss.update();

  charts.acc.data.labels = [];
  charts.acc.data.datasets[0].data = [];
  charts.acc.update();

  // lr
  charts.lr.data.labels = [];
  charts.lr.data.datasets[0].data = [];
  charts.lr.update();


  document.getElementById('accChart').style.display = showAcc ? 'block' : 'none';
}

/* ========= DOM 綁定 ========= */
document.addEventListener('DOMContentLoaded', () => {

  /* --- 1) 載入資料頁 --- */
  const trainCsv = document.getElementById('trainCsv');
  const trainPreview = document.getElementById('trainPreview');
  const targetSelect = document.getElementById('targetSelect');
  const varTbody = document.querySelector('#varTable tbody');

  trainCsv.addEventListener('change', (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    Papa.parse(file, {
      header: true, skipEmptyLines: true, complete: (res) => {
        rawData = res.data;
        columns = res.meta.fields || Object.keys(rawData[0] || {});
        // 目標欄位清單
        targetSelect.innerHTML = '';
        columns.forEach(c => { const opt = document.createElement('option'); opt.value = c; opt.textContent = c; targetSelect.appendChild(opt); });
        // 變數設定表
        varTbody.innerHTML = '';
        columns.forEach(c => {
          const tr = document.createElement('tr');
          const nameTd = document.createElement('td'); nameTd.textContent = c;
          const typeTd = document.createElement('td'); const sel = document.createElement('select'); sel.innerHTML = '<option value="auto">自動判斷</option><option value="numeric">數值</option><option value="category">類別</option>'; typeTd.appendChild(sel);
          const featTd = document.createElement('td'); const chk = document.createElement('input'); chk.type = 'checkbox'; chk.checked = true; featTd.appendChild(chk);
          tr.appendChild(nameTd); tr.appendChild(typeTd); tr.appendChild(featTd);
          varTbody.appendChild(tr);
        });
        trainPreview.textContent = `已載入：${file.name}（${rawData.length} 行 × ${columns.length} 欄）`;
        document.getElementById('downloadMetaBtn').disabled = false; // 之後可把當前設定存 metadata.json
      }
    });
  });

  /* --- 2) 模型設定頁：載入既有 TF.js 模型 --- */
  const loadModelBtn = document.getElementById('loadModelBtn');
  const loadStatus = document.getElementById('loadStatus');
  const resetModelBtn = document.getElementById('resetModelBtn');
  resetModelBtn.addEventListener('click', () => {
    try {
      if (tfModel?.dispose) tfModel.dispose();
    } catch (_) { }
    tfModel = null;
    traditionalModel = null;
    meta = null; // 清掉前處理，避免舊設定誤用

    // 停用與清理 UI 狀態
    document.getElementById('predictBtn').disabled = true;
    document.getElementById('downloadModelBtn').disabled = true;
    document.getElementById('downloadMLModelBtn').disabled = true;
    document.getElementById('downloadMetaBtn').disabled = true;

    // 訊息提示（模型設定分頁）
    const loadStatus = document.getElementById('loadStatus');
    if (loadStatus) loadStatus.textContent = '🧹 已清空目前模型與設定，請重新訓練或載入 TF.js 模型 + metadata.json';

    // 訓練頁狀態列
    const statusEl = document.getElementById('status');
    if (statusEl) statusEl.textContent = '🧹 已清空模型';
  });

  loadModelBtn.addEventListener('click', async () => {
    loadStatus.textContent = '讀取中…';
    try {
      const jsonFile = document.getElementById('modelJson').files[0];
      const binFile = document.getElementById('modelBin').files[0];
      const metaFile = document.getElementById('metaJson').files[0];
      if (!jsonFile) throw new Error('請選擇 model.json');
      if (!binFile) throw new Error('請選擇 .bin 權重檔');
      if (!metaFile) throw new Error('請選擇 metadata.json');

      if (!jsonFile.name.toLowerCase().endsWith('.json')) throw new Error('model.json 檔名不正確');
      if (!binFile.name.toLowerCase().endsWith('.bin')) throw new Error('權重檔需為 .bin');
      if (!metaFile.name.toLowerCase().endsWith('.json')) throw new Error('metadata.json 檔名不正確');

      if (tfModel?.dispose) tfModel.dispose();
      tfModel = await tf.loadLayersModel(tf.io.browserFiles([jsonFile, binFile]));

      const metaText = await metaFile.text();
      const cleaned = metaText.replace(/[\u0000-\u001F\u007F]/g, '');
      const parsed = JSON.parse(cleaned);
      if (!parsed || !parsed.featureCols || !parsed.colTypes) throw new Error('metadata.json 結構不完整');
      meta = parsed;
      if (meta.normalizeTarget == null) meta.normalizeTarget = false;


      loadStatus.textContent = '✅ 模型與設定載入完成';
      document.getElementById('predictBtn').disabled = false;
    } catch (err) {
      console.error(err);
      loadStatus.textContent = '❌ 載入失敗：' + err.message;
    }
  });

  /* --- 3) 訓練頁 --- */
  const trainBtn = document.getElementById('trainBtn');
  const statusEl = document.getElementById('status');

  document.getElementById('modelSelect').addEventListener('change', (e) => {
    const val = e.target.value;
    const treeModels = ['tree', 'rf', 'extra_tree']; // 可以擴充
    if (treeModels.includes(val)) {
      document.getElementById('treeParams').style.display = 'block';
    } else {
      document.getElementById('treeParams').style.display = 'none';
    }
  });

  trainBtn.addEventListener('click', async () => {
    try {
      if (!rawData.length) { alert('請先到「載入資料」頁上傳 CSV'); return; }
      const target = document.getElementById('targetSelect').value;
      if (!target) { alert('請選擇目標欄位'); return; }

      const modelSel = document.getElementById('modelSelect').value;
      const epochs = parseInt(document.getElementById('epochs').value, 10);
      const batchSize = parseInt(document.getElementById('batchSize').value, 10);
      const lr = parseFloat(document.getElementById('lr').value);
      const scheduleType = (document.getElementById('lrSchedule')?.value) || 'constant';
      const ratio = Math.max(0.5, Math.min(0.95, parseFloat(document.getElementById('trainRatio').value) || 0.8));
      const normalize = document.getElementById('normalize').checked;

      statusEl.textContent = '資料前處理中…';
      const { X, y, meta: prep } = prepareXY(rawData, target, normalize);
      meta = { ...prep, modelType: modelSel }; // 保存設定到全域
      // 切 train/test
      const n = X.length, idx = [...Array(n).keys()];
      for (let i = n - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[idx[i], idx[j]] = [idx[j], idx[i]]; }
      const cut = Math.floor(n * ratio), tr = idx.slice(0, cut), te = idx.slice(cut);
      const Xtr = tr.map(i => X[i]), ytr = tr.map(i => y[i]), Xte = te.map(i => X[i]), yte = te.map(i => y[i]);

      const traditionalList = Object.keys(ML_MODEL_MAP);
      const isTraditional = traditionalList.includes(modelSel);

      // 圖表 reset
      resetCharts(!isTraditional && meta.task === 'classification');
      document.getElementById('metricsBox').style.display = 'block';
      document.getElementById('bestMetric').textContent = '—';
      document.getElementById('finalMetric').textContent = '—';

      // Auto 決策
      if (modelSel === 'auto') {
        const candidates = AUTO_MODEL_CANDIDATES[meta.task];
        let bestScore = meta.task === 'classification' ? 0 : Infinity;
        let bestModel = null;
        let bestModelType = null;

        for (const modelType of candidates) {
          statusEl.textContent = `AutoML 嘗試模型：${modelType}`;

          // 1) 建模型時傳入 modelType
          const model = makeModel(
            Xtr[0].length,
            meta.task,
            modelType,                                  // ← 這裡
            (meta.labelInfo?.classes.length || 2),
            lr,
            scheduleType,
            epochs
          );

          const isSequenceModel = ['rnn', 'lstm'].includes(modelType);

          const xTr = isSequenceModel
            // 注意：這裡要呼叫小寫的 Xtr
            ? tf.tensor2d(Xtr).reshape([Xtr.length, Xtr[0].length, 1])
            : tf.tensor2d(Xtr);
          const yTrT = tf.tensor1d(ytr, 'float32');
          const xTe = isSequenceModel
            ? tf.tensor2d(Xte).reshape([Xte.length, Xtr[0].length, 1])
            : tf.tensor2d(Xte);
          const yTeT = tf.tensor1d(yte, 'float32');





          let currentBest = meta.task === 'classification' ? 0 : Infinity;
          let history;

          try {
            history = await model.fit(xTr, yTrT, {
              epochs,
              batchSize,
              shuffle: true,
              validationData: [xTe, yTeT],
              verbose: 0,
              callbacks: {
                onEpochEnd: (epoch, logs) => {
                  const metric = meta.task === 'classification'
                    ? logs.val_accuracy ?? logs.val_acc ?? 0
                    : logs.val_loss ?? Infinity;

                  if (meta.task === 'classification') {
                    if (metric > currentBest) currentBest = metric;
                  } else {
                    if (metric < currentBest) currentBest = metric;
                  }

                  statusEl.textContent = `訓練中（${modelType}）：Epoch ${epoch + 1}/${epochs} → Score = ${metric.toFixed(4)}`;
                }
              }
            });
          } catch (err) {
            console.error(`❌ 模型 ${modelType} 訓練錯誤：${err.message}`);
            model.dispose();
            continue; // 跳過這個模型
          }

          // 訓練完成後 → 決定是否保留
          let finalMetric;
          const metricArr = meta.task === 'classification'
            ? history.history.val_accuracy ?? history.history.val_acc
            : history.history.val_loss;

          finalMetric = Array.isArray(metricArr) ? metricArr.at(-1) : NaN;

          const isBetter = meta.task === 'classification'
            ? finalMetric > bestScore
            : finalMetric < bestScore;

          const tag = meta.task === 'classification' ? 'val_accuracy' : 'val_loss';
          logAutoInfo(`AutoML 模型 ${modelType} → ${tag} = ${finalMetric.toFixed(4)}`);
          logAutoInfo(`模型 ${modelType} → best val score = ${currentBest.toFixed(4)}`);

          if (isBetter) {
            if (bestModel) bestModel.dispose(); // 釋放前一個最佳模型
            bestModel = model;
            bestModelType = modelType;
            bestScore = finalMetric;
          } else {
            model.dispose(); // 不是最佳 → 清掉
          }

          xTr.dispose(); yTrT.dispose(); xTe.dispose(); yTeT.dispose();
        }

        tfModel?.dispose?.();
        tfModel = bestModel;
        meta.modelType = bestModelType;

        // 顯示最佳模型摘要
        const summaryText = getModelSummaryText(tfModel);
        document.getElementById('summaryText').textContent = summaryText;
        document.getElementById('modelSummary').style.display = 'block';

        // 顯示效能
        document.getElementById('bestMetric').textContent =
          meta.task === 'classification' ? `Best Val Accuracy: ${bestScore.toFixed(4)}` : `Best Val MSE: ${bestScore.toFixed(6)}`;
        document.getElementById('finalMetric').textContent = `使用模型：${bestModelType}`;

        statusEl.textContent = `✅ 進階 AutoML 選出最佳模型：${bestModelType}`;
        document.getElementById('downloadModelBtn').disabled = false;
        document.getElementById('downloadMetaBtn').disabled = false;
        document.getElementById('predictBtn').disabled = false;

        return;
      }
      if (isTraditional) {
        const spec = ML_MODEL_MAP[modelSel];
        const ctorName = (meta.task === 'regression') ? spec.reg : spec.cls;
        const modelParams = { task: meta.task };
        if (['tree', 'rf', 'extra_tree'].includes(modelSel)) {
          modelParams.maxDepth = parseInt(document.getElementById('maxDepth').value, 10);
          modelParams.minSamplesSplit = parseInt(document.getElementById('minSamplesSplit').value, 10);
          if (modelSel === 'rf') {
            modelParams.nEstimators = parseInt(document.getElementById('nEstimators').value, 10);
          }
        }
        if (!ctorName) throw new Error(`${modelSel} 不支援 ${meta.task} 任務`);
        if (!MLBundle[ctorName]) throw new Error(`MLBundle.${ctorName} 不存在`);

        traditionalModel = new MLBundle[ctorName](Xtr, ytr, modelParams);


        const pred = traditionalModel.predict(Xte);
        if (meta.task === 'classification') {
          const acc = pred.filter((p, i) => p === yte[i]).length / yte.length;
          document.getElementById('bestMetric').textContent = `Accuracy = ${acc.toFixed(4)}`;
          document.getElementById('finalMetric').textContent = `Test Accuracy = ${acc.toFixed(4)}`;

          // === Confusion Matrix ===
          const uniqueLabels = [...new Set(yte)];
          // const cm = Array(uniqueLabels.length).fill(0).map(() => Array(uniqueLabels.length).fill(0));
          const labels = [...new Set(yte)];
          const toIdx = new Map(labels.map((l, i) => [l, i]));
          const cm = Array(labels.length).fill(0).map(() => Array(labels.length).fill(0));
          yte.forEach((t, i) => {
            const ti = toIdx.get(t);
            const pi = toIdx.get(pred[i]);
            if (ti != null && pi != null) cm[ti][pi]++;
          });
          renderConfusionMatrix('confusionMatrixCanvas', cm, labels);

          if (charts.confusion) charts.confusion.destroy();
          renderConfusionMatrix('confusionMatrixCanvas', cm, uniqueLabels);

          // === Performance Report ===
          const metrics = calcClassificationMetrics(yte, pred, uniqueLabels);
          renderMetricsTable('metricsTable', metrics);

          // === ROC & AUROC（二元分類才畫）===
          if (uniqueLabels.length === 2 && traditionalModel.predictProba) {
            const probs = traditionalModel.predictProba(Xte).map(v => v[1]);
            const { fpr, tpr, auc } = calcROC(yte, probs);
            renderROC('rocCanvas', fpr, tpr, auc);
          }

        } else {
          const mse = yte.reduce((s, yv, i) => s + Math.pow(yv - pred[i], 2), 0) / yte.length;
          const rmse = Math.sqrt(mse);
          document.getElementById('bestMetric').textContent = `MSE = ${mse.toFixed(6)} | RMSE = ${rmse.toFixed(6)}`;
          document.getElementById('finalMetric').textContent = `Test MSE = ${mse.toFixed(6)} | Test RMSE = ${rmse.toFixed(6)}`;
        }

        statusEl.textContent = '✅ 傳統 ML 訓練完成';
        document.getElementById('downloadModelBtn').disabled = true;
        document.getElementById('downloadMLModelBtn')?.removeAttribute('disabled');
        document.getElementById('downloadMetaBtn').disabled = false;
        document.getElementById('predictBtn').disabled = false;
        return;
      }

      // TF.js 訓練
      traditionalModel = null;
      statusEl.textContent = '訓練 TF.js 模型中…';
      const inDim = Xtr[0].length;
      let classes = null, yTrT, yTeT;
      if (meta.task === 'classification') {
        classes = meta.labelInfo.classes;
        yTrT = tf.tensor1d(ytr.map(v => +v), 'float32');
        yTeT = tf.tensor1d(yte.map(v => +v), 'float32');
      } else {
        yTrT = tf.tensor1d(ytr, 'float32');
        yTeT = tf.tensor1d(yte, 'float32');
      }
      tfModel?.dispose?.();
      tfModel = makeModel(inDim, meta.task, modelSel, classes ? classes.length : 1, lr, scheduleType, epochs);

      const xTr = tf.tensor2d(Xtr, undefined, 'float32');
      const xTe = tf.tensor2d(Xte, undefined, 'float32');

      let best = meta.task === 'classification' ? 0 : Number.POSITIVE_INFINITY;
      // 優化器與學習率調度
      const lrCb = getLRSchedulerCallback(tfModel, lr, scheduleType, epochs, { stepSize: 10, gamma: 0.5, expK: 0.05 });

      // 訓練模型
      await tfModel.fit(xTr, yTrT, {
        epochs, batchSize, shuffle: true, validationData: [xTe, yTeT],
        callbacks: [lrCb, {
          onEpochEnd: (epoch, logs) => {
            charts.loss.data.labels.push(charts.loss.data.labels.length + 1);
            charts.loss.data.datasets[0].data.push(logs.loss);       // Train Loss
            charts.loss.data.datasets[1].data.push(logs.val_loss);   // Val Loss
            charts.loss.update();

            if (meta.task === 'classification' && (logs.val_accuracy !== undefined || logs.val_acc !== undefined)) {
              const acc = logs.val_accuracy ?? logs.val_acc ?? 0;
              charts.acc.data.labels.push(charts.acc.data.labels.length + 1);
              charts.acc.data.datasets[0].data.push(acc);
              charts.acc.update();
              if (acc > best) best = acc;
              document.getElementById('bestMetric').textContent = `Best Val Acc = ${best.toFixed(4)}`;
              document.getElementById('finalMetric').textContent = `Val Acc = ${(acc ?? 0).toFixed(4)}`;
            } else {
              const cur = logs.val_loss ?? logs.loss;
              if (cur < best) best = cur;
              document.getElementById('bestMetric').textContent = `Best Val MSE = ${best.toFixed(6)} (RMSE=${Math.sqrt(best).toFixed(6)})`;
              document.getElementById('finalMetric').textContent = `Val MSE = ${cur.toFixed(6)} (RMSE=${Math.sqrt(cur).toFixed(6)})`;
            }
            const curLR = typeof lrCb.getCurrentLR === 'function' ? lrCb.getCurrentLR() : null;

            if (curLR != null) {
              charts.lr.data.labels.push(epoch + 1);
              charts.lr.data.datasets[0].data.push(curLR);
              charts.lr.update();
            }

            statusEl.textContent = `訓練中…（Epoch ${epoch + 1}/${epochs}）`;
          },
          onTrainEnd: async () => {
            const yTrue = yTeT.arraySync();
            const yPredProb = tfModel.predict(xTe).arraySync();
            // 把預測結果都攤平成單一數值或類別索引
            const yPred = yPredProb.map(v =>
              Array.isArray(v)
                ? (v.length > 1
                  ? v.indexOf(Math.max(...v))   // multi-class
                  : v[0] > 0.5 ? 1 : 0           // binary sigmoid
                )
                : v > 0.5
                  ? 1
                  : 0
            );

            if (meta.task === 'classification') {
              // ── 分類：混淆矩陣、Performance Report、ROC ──
              const classes = [...new Set(yTrue)];
              const toIdx = new Map(classes.map((c, i) => [c, i]));
              const cm = Array(classes.length)
                .fill(0)
                .map(() => Array(classes.length).fill(0));

              yTrue.forEach((t, i) => {
                const r = toIdx.get(t), c = toIdx.get(yPred[i]);
                if (r != null && c != null) cm[r][c]++;
              });
              renderConfusionMatrix('confusionMatrixCanvas', cm, classes);

              const metrics = calcClassificationMetrics(yTrue, yPred, classes);
              renderMetricsTable('metricsTable', metrics);

              if (classes.length === 2) {
                // 取 class=1 的機率作 ROC
                const probs = yPredProb.map(v =>
                  Array.isArray(v) ? (v.length > 1 ? v[1] : v[0]) : v
                );
                const { fpr, tpr, auc } = calcROC(yTrue, probs);
                renderROC('rocCanvas', fpr, tpr, auc);
              }
            }
            else {
              // ── 回歸：只算 MSE ──
              //   const preds = yPredProb.map(v =>
              //     Array.isArray(v) ? v[0] : v
              //   );
              //   const mse =
              //   yTrue.reduce((sum, t, i) => sum + Math.pow(t - preds[i], 2), 0) /
              //   yTrue.length;
              // const rmse = Math.sqrt(mse);
              // document.getElementById('finalMetric').textContent = `Final MSE = ${mse.toFixed(6)} | Final RMSE = ${rmse.toFixed(6)}`;
            }

            // summary 與按鈕啟用
            const summaryText = getModelSummaryText(tfModel);
            document.getElementById('summaryText').textContent = summaryText;
            document.getElementById('modelSummary').style.display = 'block';
            statusEl.textContent = '✅ 訓練完成（TF.js）';
            document.getElementById('downloadModelBtn').disabled = false;
            document.getElementById('downloadMetaBtn').disabled = false;
            document.getElementById('downloadMLModelBtn').disabled = true;
            document.getElementById('predictBtn').disabled = false;
          }
        }]
      });
      xTr.dispose(); xTe.dispose(); yTrT.dispose(); yTeT.dispose();
    } catch (err) {
      console.error(err);
      statusEl.textContent = '❌ 訓練失敗：' + err.message;
    }
  });

  // 匯出
  document.getElementById('downloadModelBtn').addEventListener('click', async () => {
    if (!tfModel) { alert('目前模型不可下載（傳統 ML 不支援或尚未訓練 TF.js 模型）'); return; }
    try { await tfModel.save('downloads://tfjs_model'); } catch (e) { alert('下載失敗：' + e.message); }
  });
  document.getElementById('downloadMetaBtn').addEventListener('click', () => {
    if (!meta) { alert('尚未有可匯出的 metadata'); return; }
    downloadBlob('metadata.json', JSON.stringify(meta, null, 2), 'application/json');
  });

  document.getElementById('downloadMLModelBtn').addEventListener('click', () => {
    if (!traditionalModel) {
      alert('目前沒有傳統 ML 模型可匯出');
      return;
    }
    // 打包必要資訊：模型類型/任務、特徵設定、正規化、以及模型本體的可序列化狀態
    const pkg = {
      format: 'mlbundle-experimental-v1',
      timestamp: new Date().toISOString(),
      task: meta?.task ?? null,
      modelType: meta?.modelType ?? null,       // 例如 'rf', 'tree', ...
      preprocessor: meta ? {
        featureCols: meta.featureCols,
        colTypes: meta.colTypes,
        catMaps: meta.catMaps,                  // one-hot 對應
        numStats: meta.numStats,                // MinMax / Z-score 參數
        normalize: meta.normalize,
        targetCol: meta.targetCol,
        labelInfo: meta.labelInfo ?? null
      } : null,
      // 嘗試序列化模型（依 MLBundle 內部實作而定）
      modelState: JSON.parse(safeStringify(traditionalModel))
    };

    try {
      downloadBlob('ml_model.json', JSON.stringify(pkg, null, 2), 'application/json');
    } catch (e) {
      console.error(e);
      alert('匯出失敗：' + e.message);
    }
  });


  /* --- 4) 預測頁 --- */
  const predictBtn = document.getElementById('predictBtn');
  predictBtn.addEventListener('click', () => {
    const pf = document.getElementById('predictCsv').files?.[0];
    if (!meta) { alert('請先訓練或載入模型與 metadata'); return; }
    if (!pf) { alert('請上傳要預測的 CSV'); return; }

    const status = document.getElementById('predictStatus'); status.textContent = '資料處理中…';
    Papa.parse(pf, {
      header: true, skipEmptyLines: true, complete: (res) => {
        try {
          const rows = res.data;
          const Xnew = transformFeatures(rows, meta);

          if (traditionalModel) {
            let pred = traditionalModel.predict(Xnew);

            // ✅ 只有當「訓練時」有做目標標準化才還原
            if (meta.task === 'regression' && meta.normalizeTarget &&
              Number.isFinite(meta.yMean) && Number.isFinite(meta.yStd)) {
              pred = pred.map(v => (v * meta.yStd) + meta.yMean);
            }

            if (meta.task === 'classification' && meta.labelInfo) {
              lastPredRows = rows.map((r, i) => ({
                ...r,
                預測值: meta.labelInfo.classes[pred[i]] ?? pred[i]
              }));
            } else {
              lastPredRows = rows.map((r, i) => ({ ...r, 預測值: pred[i] }));
            }
            renderTable('predictTable', lastPredRows.slice(0, 100));
            status.textContent = '✅ 完成（傳統 ML）';
            document.getElementById('downloadPredBtn').disabled = false;
            return;
          }

          // === TF.js 模型預測 ===
          if (!tfModel) { alert('請先以 TF.js 訓練或在設定頁載入 TF.js 模型'); return; }
          const x = tf.tensor2d(Xnew, undefined, 'float32');
          const p = tfModel.predict(x);

          if (meta.task === 'classification') {
            const probs = p.arraySync();
            const cls = meta.labelInfo?.classes || [];
            const idx = probs.map(v => {
              if (Array.isArray(v)) {
                if (v.length > 1) {
                  let mi = 0, mv = v[0];
                  for (let i = 1; i < v.length; i++) if (v[i] > mv) { mv = v[i]; mi = i; }
                  return mi;
                } else return v[0] > 0.5 ? 1 : 0;
              }
              return v > 0.5 ? 1 : 0;
            });
            lastPredRows = rows.map((r, i) => ({
              ...r,
              預測值: (cls[idx[i]] !== undefined ? cls[idx[i]] : idx[i])
            }));
          } else {
            let vals = p.arraySync().map(v => Array.isArray(v) ? v[0] : v);

            // ✅ 只依據訓練時的 meta.normalizeTarget 來還原
            if (meta.task === 'regression' && meta.normalizeTarget &&
            Number.isFinite(meta.yMean) && Number.isFinite(meta.yStd)) {
          vals = vals.map(v => (v * meta.yStd) + meta.yMean);
        }
        
            lastPredRows = rows.map((r, i) => ({ ...r, 預測值: vals[i] }));
          }
          x.dispose(); p.dispose();
          renderTable('predictTable', lastPredRows.slice(0, 100));
          status.textContent = '✅ 完成（TF.js）';
          document.getElementById('downloadPredBtn').disabled = false;

        } catch (e) {
          console.error(e);
          status.textContent = '❌ 預測失敗：' + e.message;
        }
      }
    });
  });

  document.getElementById('downloadPredBtn').addEventListener('click', () => {
    if (!lastPredRows.length) return;
    downloadBlob('predictions.csv', toCSV(lastPredRows), 'text/csv');
  });

});
