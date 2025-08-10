// 60_models.js (drag-n-drop blocks, final)
(function () {
  const AML = window.AML;
  AML.state = AML.state || {};
  AML.state.customLayers = AML.state.customLayers || [];
  AML.state.customEnabled = AML.state.customEnabled || false;

  const $ = (id) => document.getElementById(id);
  const uid = () => 'L' + Math.random().toString(36).slice(2, 9);

  /* --------------------------
   * 渲染：把 state -> DOM
   * -------------------------- */
  function layerRowTpl(L) {
    // 共同外觀
    const base = `
      <div class="drag-handle" title="拖曳排序">⠿</div>
      <div class="layer-head">
        <strong>${L.type.toUpperCase()}</strong>
        <button class="btn-remove" data-action="remove" title="刪除">❌</button>
      </div>
    `;

    // 各型別控制項（使用 data-key 事件委派，不用 inline handler）
    if (L.type === 'dense') {
      return `
        ${base}
        <div class="layer-body">
          <label>Units
            <input type="number" class="ctl" data-key="units" value="${L.units ?? 64}" min="1" step="1">
          </label>
          <label>Activation
            <select class="ctl" data-key="activation">
              ${['relu','tanh','sigmoid','linear'].map(a => `<option value="${a}" ${a === (L.activation || 'relu') ? 'selected':''}>${a}</option>`).join('')}
            </select>
          </label>
        </div>
      `;
    }
    if (L.type === 'dropout') {
      return `
        ${base}
        <div class="layer-body">
          <label>Rate
            <input type="number" class="ctl" data-key="rate" value="${L.rate ?? 0.3}" min="0" max="0.95" step="0.05">
          </label>
        </div>
      `;
    }
    if (L.type === 'batchnorm') {
      return `${base}<div class="layer-body muted">BatchNorm（無參數）</div>`;
    }
    if (L.type === 'activation') {
      return `
        ${base}
        <div class="layer-body">
          <label>Function
            <select class="ctl" data-key="activation">
              ${['relu','tanh','sigmoid','softmax','linear'].map(a => `<option value="${a}" ${a === (L.activation || 'relu') ? 'selected':''}>${a}</option>`).join('')}
            </select>
          </label>
        </div>
      `;
    }
    if (L.type === 'flatten') {
      return `${base}<div class="layer-body muted">Flatten（無參數）</div>`;
    }
    // 未知類型（保底）
    return `${base}<div class="layer-body muted">（未支援的層參數）</div>`;
  }

  AML.renderCustomLayers = function () {
    const list = $('layerList');
    if (!list) return;
    list.innerHTML = '';
    for (const L of AML.state.customLayers) {
      const item = document.createElement('div');
      item.className = 'layer-item';
      item.dataset.id = L.id;
      item.draggable = true; // HTML5 拖放
      item.innerHTML = layerRowTpl(L);
      list.appendChild(item);
    }
  };

  /* --------------------------
   * 新增 / 更新 / 刪除（只改 state）
   * -------------------------- */
  AML.addLayerFromUI = function () {
    const type = $('layerTypeSelect')?.value || 'dense';
    AML.addLayer(type);
  };

  AML.addLayer = function (type = 'dense', config = {}) {
    const L = { id: uid(), type };
    if (type === 'dense')   Object.assign(L, { units: config.units ?? 64, activation: config.activation ?? 'relu' });
    if (type === 'dropout') Object.assign(L, { rate: config.rate ?? 0.3 });
    if (type === 'activation') Object.assign(L, { activation: config.activation ?? 'relu' });
    // batchnorm / flatten 無額外參數
    AML.state.customLayers.push(L);
    AML.renderCustomLayers();
  };

  function updateLayerById(id, key, value) {
    const L = AML.state.customLayers.find(x => x.id === id);
    if (!L) return;
    if (key === 'units') L.units = parseInt(value, 10);
    else if (key === 'rate') L.rate = parseFloat(value);
    else L[key] = value;
  }

  AML.removeLayer = function (id) {
    const idx = AML.state.customLayers.findIndex(x => x.id === id);
    if (idx >= 0) {
      AML.state.customLayers.splice(idx, 1);
      AML.renderCustomLayers();
    }
  };

  // 讓 HTML onclick 相容（舊有呼叫可能存在）
  window.addLayerFromUI = AML.addLayerFromUI;
  window.addLayer = AML.addLayer;
  window.updateLayer = function (indexOrId, key, value) {
    // 兼容舊版以 index 傳入
    const id = typeof indexOrId === 'string'
      ? indexOrId
      : (AML.state.customLayers[indexOrId]?.id);
    if (!id) return;
    updateLayerById(id, key, value);
  };
  window.removeLayer = function (indexOrId) {
    const id = typeof indexOrId === 'string'
      ? indexOrId
      : (AML.state.customLayers[indexOrId]?.id);
    if (!id) return;
    AML.removeLayer(id);
  };

  /* --------------------------
   * 事件委派：同一組監聽處理所有卡片
   * -------------------------- */
  function wireLayerListEventsOnce() {
    if (AML._layerListWired) return;
    AML._layerListWired = true;

    const list = $('layerList');
    if (!list) return;

    // 1) 變更參數（input/select）
    list.addEventListener('input', (e) => {
      const ctl = e.target.closest('.ctl');
      if (!ctl) return;
      const item = e.target.closest('.layer-item'); if (!item) return;
      const id = item.dataset.id;
      const key = ctl.dataset.key;
      const val = ctl.value;
      updateLayerById(id, key, val);
    });
    list.addEventListener('change', (e) => {
      const ctl = e.target.closest('.ctl');
      if (!ctl) return;
      const item = e.target.closest('.layer-item'); if (!item) return;
      const id = item.dataset.id;
      const key = ctl.dataset.key;
      const val = ctl.value;
      updateLayerById(id, key, val);
    });

    // 2) 刪除
    list.addEventListener('click', (e) => {
      const btn = e.target.closest('.btn-remove');
      if (!btn) return;
      const item = e.target.closest('.layer-item'); if (!item) return;
      AML.removeLayer(item.dataset.id);
    });

    // 3) 拖拉排序（HTML5 DnD）
    let draggingId = null;

    list.addEventListener('dragstart', (e) => {
      const item = e.target.closest('.layer-item'); if (!item) return;
      draggingId = item.dataset.id;
      item.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      // 有些瀏覽器需要 setData 才能啟用 drop
      e.dataTransfer.setData('text/plain', draggingId);
    });

    list.addEventListener('dragend', (e) => {
      const item = e.target.closest('.layer-item');
      if (item) item.classList.remove('dragging');
      draggingId = null;
      // 清除提示樣式
      list.querySelectorAll('.layer-item.over-top, .layer-item.over-bottom').forEach(el=>{
        el.classList.remove('over-top','over-bottom');
      });
    });

    list.addEventListener('dragover', (e) => {
      e.preventDefault(); // 允許 drop
      const target = e.target.closest('.layer-item');
      if (!target || target.dataset.id === draggingId) return;
      const rect = target.getBoundingClientRect();
      const before = (e.clientY - rect.top) < rect.height / 2;
      target.classList.toggle('over-top', before);
      target.classList.toggle('over-bottom', !before);
    });

    list.addEventListener('dragleave', (e) => {
      const target = e.target.closest('.layer-item');
      if (target) target.classList.remove('over-top','over-bottom');
    });

    list.addEventListener('drop', (e) => {
      e.preventDefault();
      const target = e.target.closest('.layer-item');
      if (!target || !draggingId) return;
      const targetId = target.dataset.id;
      if (targetId === draggingId) return;

      const rect = target.getBoundingClientRect();
      const before = (e.clientY - rect.top) < rect.height / 2;

      const arr = AML.state.customLayers;
      const from = arr.findIndex(x => x.id === draggingId);
      let to = arr.findIndex(x => x.id === targetId);
      if (!before) to += 1;
      // 調整 index（拖下方往下放時，splice 後偏移）
      const [m] = arr.splice(from, 1);
      const adj = from < to ? to - 1 : to;
      arr.splice(adj, 0, m);

      // 重新渲染
      AML.renderCustomLayers();

      // 清理樣式
      list.querySelectorAll('.layer-item.over-top, .layer-item.over-bottom').forEach(el=>{
        el.classList.remove('over-top','over-bottom');
      });
    });
  }

  /* --------------------------
   * 模型卡 UI（維持你原有功能）
   * -------------------------- */
  AML.setupModelUI = function () {
    const modeGroup = $('modelModeGroup');
    const grid = $('presetModels');
    const customBox = $('customLayersContainer');

    const TFJS = [
      { v:'linear',   t:'Linear Regression', s:'回歸基準，線性關係', tags:['回歸','快速'] },
      { v:'logistic', t:'Logistic Regression', s:'二元/多類分類基準', tags:['分類','線性'] },
      { v:'mlp',      t:'MLP', s:'通用前饋網路', tags:['分類','回歸'] },
      { v:'mlp_bn',   t:'MLP + BatchNorm', s:'更穩定的訓練', tags:['分類','回歸'] },
      { v:'deepmlp',  t:'Deep MLP', s:'更深的特徵抽取', tags:['分類','回歸'] },
      { v:'wide_deep',t:'Wide & Deep', s:'線性 + 非線性混合', tags:['分類','回歸'] },
      { v:'tabnet',   t:'TabNet-like', s:'表格資料友善（簡化）', tags:['分類','回歸'] },
      { v:'poly',     t:'Polynomial Regression', s:'非線性回歸基準', tags:['回歸'] },
      { v:'lstm',     t:'LSTM', s:'序列 / 時間序列', tags:['序列'] },
      { v:'rnn',      t:'RNN', s:'序列 / 時間序列', tags:['序列'] },
    ];
    const MLTREE = [
      { v:'tree', t:'Decision Tree', s:'可解釋，容易過擬合', tags:['分類','回歸'] },
      { v:'rf',   t:'Random Forest', s:'集成樹，表現穩定', tags:['分類','回歸'] },
      { v:'knn',  t:'KNN', s:'鄰近度基準，需正規化', tags:['分類','回歸'] },
      { v:'svm',  t:'SVM', s:'間隔最大化，核技巧可強', tags:['分類','回歸'] },
      { v:'nb',   t:'Naive Bayes', s:'朴素假設，計算快', tags:['分類'] },
    ];

    let lastSelectedBtn = null;

    function makeCard({ v, t, s, tags }) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'model-card';
      btn.dataset.model = v;
      btn.innerHTML = `
        <div class="title">${t}</div>
        <div class="desc" style="font-size:12px;color:#666;">${s}</div>
        <div class="badges">${(tags || []).map(x => `<span class="badge">${x}</span>`).join('')}</div>`;
      btn.addEventListener('click', () => {
        if (lastSelectedBtn) lastSelectedBtn.classList.remove('selected');
        lastSelectedBtn = btn; btn.classList.add('selected');
        AML.state.selectedModel = v;
        if (typeof AML.showMLParams === 'function') AML.showMLParams(v);
      });
      return btn;
    }

    function renderGrid() {
      grid.innerHTML = '';
      const t1 = document.createElement('div');
      t1.textContent = '🔥 TensorFlow.js';
      t1.style.cssText = 'grid-column:1/-1;font-weight:600;margin-top:6px;color:#444;';
      grid.appendChild(t1);
      TFJS.forEach(m => grid.appendChild(makeCard(m)));

      const t2 = document.createElement('div');
      t2.textContent = '⚡ ML-bundle.js';
      t2.style.cssText = 'grid-column:1/-1;font-weight:600;margin-top:10px;color:#444;';
      grid.appendChild(t2);
      MLTREE.forEach(m => grid.appendChild(makeCard(m)));
    }

    function setMode(mode) {
      AML.state.mode = mode;
      [...modeGroup.querySelectorAll('.mode-btn')].forEach(b => b.classList.toggle('active', b.dataset.mode === mode));

      if (mode === 'auto') {
        AML.state.customEnabled = false;
        grid.classList.add('hidden');
        if (customBox) customBox.style.display = 'none';
        if (typeof AML.showMLParams === 'function') AML.showMLParams('auto');
      } else if (mode === 'preset') {
        AML.state.customEnabled = false;
        if (!grid.dataset.inited) { renderGrid(); grid.dataset.inited = '1'; }
        grid.classList.remove('hidden');
        if (customBox) customBox.style.display = 'none';
        if (typeof AML.showMLParams === 'function') AML.showMLParams(AML.state.selectedModel);
      } else if (mode === 'custom') {
        AML.state.customEnabled = true;
        grid.classList.add('hidden');
        if (customBox) customBox.style.display = 'block';
        if (!AML.state.selectedModel) AML.state.selectedModel = 'mlp';
        if (typeof AML.showMLParams === 'function') AML.showMLParams(AML.state.selectedModel);
        // 確保拖拉事件只綁一次
        wireLayerListEventsOnce();
        // 初次渲染
        AML.renderCustomLayers();
      }
    }

    modeGroup?.addEventListener('click', (e) => {
      const btn = e.target.closest('.mode-btn');
      if (!btn) return;
      setMode(btn.dataset.mode);
    });

    // 預設 Auto
    setMode(AML.state.mode || 'auto');
  };

  /* --------------------------
   * TF.js makeModel（維持原功能）
   * -------------------------- */
  AML.makeModel = function (inputDim, task, modelType, nClasses = 2, lr = 0.001, scheduleType = 'constant', epochs = 50, opts = { l2: 0, dropout: 0.2, wideUnitsFactor: 2 }) {
    const isCls = task === 'classification';
    const binary = isCls && nClasses === 2;
    const opt = AML.getOptimizer ? AML.getOptimizer(lr) : tf.train.adam(lr);
    const reg = opts.l2 > 0 ? tf.regularizers.l2({ l2: opts.l2 }) : undefined;
    const model = tf.sequential();

    // 自訂層：如果第一層不是宣告 inputShape 的層，先插入 inputLayer
    function ensureInputIfNeeded(firstLayerType) {
      const needInput = firstLayerType && ['dropout', 'batchnorm', 'activation', 'flatten'].includes(firstLayerType);
      if (needInput) model.add(tf.layers.inputLayer({ inputShape: [inputDim] }));
    }

    const addBlock = (units, { useBN = false, dropout = 0 } = {}) => {
      if (model.layers.length === 0) {
        model.add(tf.layers.dense({ inputShape: [inputDim], units, activation: 'relu', kernelRegularizer: reg }));
      } else {
        model.add(tf.layers.dense({ units, activation: 'relu', kernelRegularizer: reg }));
      }
      if (useBN) model.add(tf.layers.batchNormalization());
      if (dropout > 0) model.add(tf.layers.dropout({ rate: dropout }));
    };

    const compileForTask = () => {
      if (isCls) {
        model.compile({ optimizer: opt, loss: binary ? 'binaryCrossentropy' : 'sparseCategoricalCrossentropy', metrics: ['accuracy'] });
      } else {
        model.compile({ optimizer: opt, loss: 'meanSquaredError' });
      }
    };

    // ===== 使用自訂層 =====
    const useCustom = AML.state.customEnabled && AML.state.customLayers.length > 0;
    if (useCustom) {
      const firstType = AML.state.customLayers[0]?.type;
      ensureInputIfNeeded(firstType);

      AML.state.customLayers.forEach(() => { /* pass; shape 由第一個 dense 決定 */ });
      for (let i = 0; i < AML.state.customLayers.length; i++) {
        const L = AML.state.customLayers[i];
        const isFirst = (model.layers.length === 0);
        switch (L.type) {
          case 'dense':
            model.add(tf.layers.dense({
              inputShape: isFirst ? [inputDim] : undefined,
              units: L.units ?? 64,
              activation: L.activation || 'relu',
              kernelRegularizer: reg
            })); break;
          case 'dropout':   model.add(tf.layers.dropout({ rate: L.rate ?? 0.3 })); break;
          case 'batchnorm': model.add(tf.layers.batchNormalization()); break;
          case 'activation':model.add(tf.layers.activation({ activation: L.activation || 'relu' })); break;
          case 'flatten':   model.add(tf.layers.flatten()); break;
          default:          console.warn('未知層類型：', L.type);
        }
      }
      // output
      model.add(tf.layers.dense({ units: isCls ? (binary ? 1 : nClasses) : 1, activation: isCls ? (binary ? 'sigmoid' : 'softmax') : 'linear', kernelRegularizer: reg }));
      compileForTask();
      return model;
    }

    // ===== 現成模型 (TF.js) =====
    if (modelType === 'linear' && !isCls) {
      model.add(tf.layers.dense({ inputShape: [inputDim], units: 1, activation: 'linear', kernelRegularizer: reg }));
      compileForTask(); return model;
    }
    if (modelType === 'logistic' && isCls) {
      model.add(tf.layers.dense({ inputShape: [inputDim], units: binary ? 1 : nClasses, activation: binary ? 'sigmoid' : 'softmax', kernelRegularizer: reg }));
      compileForTask(); return model;
    }
    if (modelType === 'poly' && !isCls) {
      addBlock(Math.max(4, inputDim * 2), { useBN: false, dropout: (opts.dropout || 0) / 2 });
      model.add(tf.layers.dense({ units: 1, activation: 'linear', kernelRegularizer: reg }));
      compileForTask(); return model;
    }
    if (['rnn', 'lstm'].includes(modelType)) {
      model.add(tf.layers.reshape({ targetShape: [inputDim, 1], inputShape: [inputDim] }));
      if (modelType === 'rnn') model.add(tf.layers.simpleRNN({ units: 32, activation: 'relu', returnSequences: false }));
      else model.add(tf.layers.lstm({ units: 32, activation: 'tanh', returnSequences: false }));
      model.add(tf.layers.dense({ units: 16, activation: 'relu' }));
    }
    if (modelType === 'mlp') {
      addBlock(64, { useBN: false, dropout: opts.dropout || 0 });
      addBlock(32, { useBN: false, dropout: 0 });
    }
    if (modelType === 'mlp_bn') {
      if (model.layers.length === 0) {
        model.add(tf.layers.dense({ inputShape: [inputDim], units: 64, activation: 'relu', kernelRegularizer: reg }));
      } else {
        model.add(tf.layers.dense({ units: 64, activation: 'relu', kernelRegularizer: reg }));
      }
      model.add(tf.layers.batchNormalization());
      addBlock(32, { useBN: true, dropout: Math.min(0.1, opts.dropout || 0) });
    }
    if (modelType === 'deepmlp') {
      addBlock(128, { useBN: false, dropout: Math.max(opts.dropout || 0, 0.3) });
      addBlock(64, { useBN: true,  dropout: 0.2 });
      addBlock(32, { useBN: false, dropout: 0 });
    }
    if (modelType === 'wide_deep') {
      const wideUnits = Math.min(256, Math.max(32, Math.floor(inputDim * (opts.wideUnitsFactor ?? 2))));
      addBlock(wideUnits, { useBN: false, dropout: 0 });
      addBlock(128, { useBN: true,  dropout: 0.1 });
      addBlock(64,  { useBN: false, dropout: 0.1 });
    }
    if (modelType === 'tabnet') {
      addBlock(Math.max(inputDim, 16), { useBN: true,  dropout: 0.1 });
      addBlock(32, { useBN: false, dropout: 0.1 });
    }
    if (model.layers.length === 0) {
      addBlock(64, { useBN: false, dropout: opts.dropout || 0 }); // fallback
    }

    // output
    if (isCls) model.add(tf.layers.dense({ units: binary ? 1 : nClasses, activation: binary ? 'sigmoid' : 'softmax', kernelRegularizer: reg }));
    else model.add(tf.layers.dense({ units: 1, activation: 'linear', kernelRegularizer: reg }));
    compileForTask();
    return model;
  };

})();
