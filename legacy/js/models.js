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
    const wrapRow = (inner) => `
      <div class="drag-handle" title="拖曳排序">⠿</div>
      <div class="layer-content">
        <strong class="layer-title">${L.type.toUpperCase()}</strong>
        <div class="inline-controls">
          ${inner}
        </div>
      </div>
      <button class="btn-remove" data-action="remove" title="刪除">❌</button>
    `;
  
    if (L.type === 'dense') {
      return wrapRow(`
        <label class="kv"><span>Units</span>
          <input type="number" class="ctl sm" data-key="units" value="${L.units ?? 64}" min="1" step="1">
        </label>
        <label class="kv"><span>Activation</span>
          <select class="ctl sm" data-key="activation">
            ${['relu','tanh','sigmoid','linear'].map(a => `
              <option value="${a}" ${a === (L.activation || 'relu') ? 'selected' : ''}>${a}</option>
            `).join('')}
          </select>
        </label>
      `);
    }
  
    if (L.type === 'dropout') {
      return wrapRow(`
        <label class="kv"><span>Rate</span>
          <input type="number" class="ctl sm" data-key="rate" value="${L.rate ?? 0.3}" min="0" max="0.95" step="0.05">
        </label>
      `);
    }
  
    if (L.type === 'batchnorm') {
      return wrapRow(`<span class="muted mono">BatchNorm（無參數）</span>`);
    }
  
    if (L.type === 'activation') {
      return wrapRow(`
        <label class="kv"><span>Function</span>
          <select class="ctl sm" data-key="activation">
            ${['relu','tanh','sigmoid','softmax','linear'].map(a => `
              <option value="${a}" ${a === (L.activation || 'relu') ? 'selected' : ''}>${a}</option>
            `).join('')}
          </select>
        </label>
      `);
    }
  
    if (L.type === 'flatten') {
      return wrapRow(`<span class="muted mono">Flatten（無參數）</span>`);
    }
  
    // fallback
    return wrapRow(`<span class="muted mono">（未支援的層參數）</span>`);
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
    const $ = (id) => document.getElementById(id);
    const modeGroup = $('modelModeGroup');
    const grid = $('presetModels');
    const customBox = $('customLayersContainer');
  
    // ==== 資料定義：更豐富的模型資訊 ====
    const TFJS = [
      {
        v:'linear', t:'Linear Regression',
        intro:'線性關係下的回歸基準，訓練快、可作為可解釋基線。',
        uses:['回歸','特徵方向/強度檢視','作為基準比較'],
        depth:'1 層（Dense 直出）', explain:'高',
        details:`最小化 MSE 的線性模型。假設線性可分、殘差同方差；權重可直接反映特徵對輸出的線性影響。`
      },
      {
        v:'logistic', t:'Logistic Regression',
        intro:'最經典的分類基線，解釋性佳。',
        uses:['二元/多類分類','概率輸出','特徵權重解釋'],
        depth:'1 層（Dense 直出）', explain:'高',
        details:`使用 sigmoid/softmax 將線性組合映射到機率空間，以交叉熵訓練；權重方向與大小可直觀解釋。`
      },
      {
        v:'mlp', t:'MLP',
        intro:'通用前饋網路，對非線性表格資料很實用。',
        uses:['分類','回歸','特徵交互擬合'],
        depth:'2–3 層（Dense）', explain:'中',
        details:`多層感知機以 ReLU/Tanh 等非線性堆疊 Dense 層，可擬合複雜關係；可搭配 L2/Dropout 正則化。`
      },
      {
        v:'mlp_bn', t:'MLP + BatchNorm',
        intro:'加入 BatchNorm 提升收斂穩定與速度。',
        uses:['分類','回歸','非線性表格'],
        depth:'2–3 層（含 BN）', explain:'中',
        details:`Batch Normalization 穩定層內分布，降低梯度消失/爆炸風險；與 Dropout 搭配常有較佳泛化。`
      },
      {
        v:'deepmlp', t:'Deep MLP',
        intro:'更深的 MLP，抽取更高階特徵。',
        uses:['複雜特徵交互','中大型資料集'],
        depth:'3–5 層', explain:'中',
        details:`更多層數與單元數提升表達力，但需正則化與良好早停策略避免過擬合。`
      },
      {
        v:'wide_deep', t:'Wide & Deep',
        intro:'線性（Wide）+ 非線性（Deep）混合，兼顧記憶與泛化。',
        uses:['稀疏特徵','大量類別 One-Hot','推薦/廣告'],
        depth:'3 層左右', explain:'中',
        details:`Wide 分支擅長記憶共現特徵；Deep 分支擅長泛化，新樣本也能表現不錯。`
      },
      {
        v:'tabnet', t:'TabNet-like',
        intro:'參考 TabNet 概念的簡化版，對表格友善。',
        uses:['表格資料','可部分觀察注意力'],
        depth:'~3 層（簡化）', explain:'中',
        details:`以稀疏注意力做特徵選擇的想法，這裡為輕量化實作，非完整 TabNet。`
      },
      {
        v:'poly', t:'Polynomial Regression',
        intro:'非線性回歸基線，能擬合曲線關係。',
        uses:['回歸基準','小型資料集'],
        depth:'2 層（隱層近似多項式）', explain:'中',
        details:`透過非線性映射近似多項式基底；注意高階易過擬合，搭配正則化較穩。`
      },
      {
        v:'lstm', t:'LSTM',
        intro:'長短期記憶網路，處理序列/時間序列。',
        uses:['時間序列預測','序列分類/回歸'],
        depth:'2–3 層（LSTM + Dense）', explain:'中',
        details:`LSTM 的門控機制能捕捉長期依賴；表格需 reshape 為序列特徵時使用。`
      },
      {
        v:'rnn', t:'RNN',
        intro:'循環網路基礎款，序列任務的輕量選擇。',
        uses:['簡單序列','短期依賴'],
        depth:'2–3 層（RNN + Dense）', explain:'中',
        details:`SimpleRNN 適合較短的依賴；較長依賴建議改 LSTM/GRU。`
      },
    ];
  
    const MLTREE = [
      {
        v:'tree', t:'Decision Tree',
        intro:'可視覺化、可追蹤決策路徑，解釋性極佳。',
        uses:['分類','回歸','規則提取'],
        depth:'樹深可調', explain:'很高',
        details:`以資訊增益/基尼等準則遞迴切分；每條路徑就是一個決策規則。過深易過擬合，建議限制深度/葉節點。`
      },
      {
        v:'rf', t:'Random Forest',
        intro:'多棵隨機樹的集成，穩定可靠。',
        uses:['分類','回歸','特徵重要度'],
        depth:'多樹（各自的樹深可調）', explain:'中（可看重要度）',
        details:`Bagging + 隨機特徵子集減少方差；提供 Gini/Permutation 重要度；對尺度不敏感。`
      },
      {
        v:'knn', t:'KNN',
        intro:'基於距離的鄰近法，訓練幾乎零成本。',
        uses:['分類','回歸','小資料基準'],
        depth:'無層（惰性學習）', explain:'中',
        details:`以距離度量找 K 個鄰居，多數表決或平均；需正規化；高維下距離不敏感需小心。`
      },
      {
        v:'svm', t:'SVM',
        intro:'最大間隔分類器，可搭核技巧。',
        uses:['分類','回歸（SVR）','中小資料'],
        depth:'無層（決策邊界）', explain:'中',
        details:`線性可分下最大化間隔；核技巧映射到高維特徵空間；對超參數 C、γ 敏感。`
      },
      {
        v:'nb', t:'Naive Bayes',
        intro:'條件獨立假設的貝氏分類器，速度快。',
        uses:['文字分類','高維稀疏','基準模型'],
        depth:'無層（機率模型）', explain:'高',
        details:`在條件獨立假設下估計先驗與似然；參數少、對小數據很穩；特徵獨立性違反時精度會降。`
      },
    ];
  
    let lastSelectedBtn = null;
  
    function pill(text){ return `<span class="badge">${text}</span>`; }
    function metaRow({uses, depth, explain}){
      return `
        <div class="model-meta">
          <span class="meta-item sep">·</span>
          <span class="meta-item">層數：<b>${depth || '—'}</b></span>
          <span class="meta-item sep">·</span>
          <span class="meta-item">可解釋性：<b>${explain || '—'}</b></span>
        </div>`;
    }
  
    // richer card
    function makeCard(m) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'model-card';
      btn.dataset.model = m.v;
  
      const usesBadges = (m.uses || []).slice(0,3).map(pill).join('');
      btn.innerHTML = `
        <div class="title">${m.t}</div>
        <div class="desc">${m.intro}</div>
        ${metaRow(m)}
        <div class="badges">${usesBadges}</div>
  
        <details class="model-more">
          <summary>更多介紹與技術原理</summary>
          <div class="more-body">
            <div class="more-h">技術原理</div>
            <div class="more-text">${m.details || '—'}</div>
          </div>
        </details>
      `;
  
      btn.addEventListener('click', (e) => {
        // 讓展開/收合不影響選取邏輯
        if (e.target.closest('summary')) return;
        if (lastSelectedBtn) lastSelectedBtn.classList.remove('selected');
        lastSelectedBtn = btn; btn.classList.add('selected');
        AML.state.selectedModel = m.v;
        if (typeof AML.showMLParams === 'function') AML.showMLParams(m.v);
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
        if (typeof wireLayerListEventsOnce === 'function') wireLayerListEventsOnce();
        if (typeof AML.renderCustomLayers === 'function') AML.renderCustomLayers();
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
