// 70_training.js (drop-in) — Auto 同時含 TF.js+傳統ML、圖表重用、模型唯一命名、
// 並在「任何訓練結束時」產生可解釋性報告（Permutation Importance + 選模理由 + 前處理摘要）
(function () {
  const AML = window.AML;

  /* =========================
   * Helpers (UI & State)
   * ========================= */

  function $(id) { return document.getElementById(id); }
  function setStatus(msg) { const el = $('status'); if (el) el.textContent = msg; }
  function safeLog(msg) { (AML.logAutoInfo ? AML.logAutoInfo : console.log)(msg); }

  function getSelectedModel() {
    return (AML.state.mode === 'auto') ? 'auto' : (AML.state.selectedModel || 'mlp');
  }

  function readTrainingUI() {
    const target = $('targetSelect')?.value;
    return {
      target,
      modelSel: getSelectedModel(),
      epochs: parseInt($('epochs')?.value, 10) || 50,
      batchSize: parseInt($('batchSize')?.value, 10) || 32,
      lr: parseFloat($('lr')?.value) || 1e-3,
      scheduleType: $('lrSchedule')?.value || 'constant',
      ratio: Math.max(0.5, Math.min(0.95, parseFloat($('trainRatio')?.value) || 0.8)),
      normalize: !!$('normalize')?.checked
    };
  }

  function resetMetricsUI(showAccChart) {
    AML.resetCharts(showAccChart);
    const box = $('metricsBox'); if (box) box.style.display = 'block';
    const best = $('bestMetric'); if (best) best.textContent = '—';
    const finalM = $('finalMetric'); if (finalM) finalM.textContent = '—';
  }

  function enableButtons({ tfModel, traditionalModel }) {
    if ($('downloadModelBtn')) $('downloadModelBtn').disabled = true;
    if ($('downloadMLModelBtn')) $('downloadMLModelBtn').disabled = true;
    if ($('downloadMetaBtn')) $('downloadMetaBtn').disabled = false;
    if ($('predictBtn')) $('predictBtn').disabled = false;

    if (tfModel && !traditionalModel) {
      $('downloadModelBtn') && ($('downloadModelBtn').disabled = false);
    } else if (traditionalModel && !tfModel) {
      $('downloadMLModelBtn') && $('downloadMLModelBtn').removeAttribute('disabled');
    }
  }

  // 單一組圖表物件重用：清空資料即可（避免增生實例）
  function clearCharts(showAcc) {
    const ch = AML.state?.charts;
    if (!ch) { AML.resetCharts(showAcc); return; }
    ch.loss.data.labels.length = 0;
    ch.loss.data.datasets[0].data.length = 0;
    ch.loss.data.datasets[1].data.length = 0;
    ch.loss.update('none');
    if (showAcc && ch.acc) {
      ch.acc.data.labels.length = 0;
      ch.acc.data.datasets[0].data.length = 0;
      ch.acc.update('none');
    }
    if (ch.lr) {
      ch.lr.data.labels.length = 0;
      ch.lr.data.datasets[0].data.length = 0;
      ch.lr.update('none');
    }
  }

  // ===== 唯一模型名稱（避免 Container 'sequential_x' is already disposed）=====
  AML._modelCounter = AML._modelCounter || 0;
  function _newModelName(prefix = 'seq') {
    AML._modelCounter += 1;
    return `${prefix}_${Date.now()}_${AML._modelCounter}`;
  }
  function _withUniqueModelName(prefix, fn) {
    const origSequential = tf.sequential;
    tf.sequential = function (cfg = {}) {
      return origSequential({ ...cfg, name: (cfg.name || _newModelName(prefix)) });
    };
    try { return fn(); }
    finally { tf.sequential = origSequential; }
  }

  /* =========================
   * Data prep
   * ========================= */

  function preflightDataset(rawData) {
    if (!Array.isArray(rawData) || rawData.length === 0) {
      throw new Error('訓練資料為空，請先上傳 CSV。');
    }
    const keys = Object.keys(rawData[0] || {});
    if (keys.length === 0) {
      throw new Error('資料無欄位，請檢查 CSV 是否包含表頭（header）。');
    }
    const suspicious = keys.filter(k => /^-?\d+(\.\d+)?$/.test(String(k)));
    if (suspicious.length) console.warn('[warn] 檢測到疑似數字欄名（可能 CSV header 有問題）：', suspicious);
  }

  function splitDataset(X, y, ratio) {
    const n = X.length;
    const idx = Array.from({ length: n }, (_, i) => i);
    for (let i = n - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [idx[i], idx[j]] = [idx[j], idx[i]];
    }
    const cut = Math.floor(n * ratio);
    const tr = idx.slice(0, cut), te = idx.slice(cut);
    return {
      Xtr: tr.map(i => X[i]),
      ytr: tr.map(i => y[i]),
      Xte: te.map(i => X[i]),
      yte: te.map(i => y[i])
    };
  }

  function tensorsFor(modelType, Xtr, Xte, ytr, yte, task) {
    const isSeq = ['rnn', 'lstm'].includes(modelType);
    const xTr = isSeq
      ? tf.tensor2d(Xtr).reshape([Xtr.length, Xtr[0].length, 1])
      : tf.tensor2d(Xtr, undefined, 'float32');
    const xTe = isSeq
      ? tf.tensor2d(Xte).reshape([Xte.length, Xtr[0].length, 1])
      : tf.tensor2d(Xte, undefined, 'float32');

    let yTrT, yTeT;
    if (task === 'classification') {
      yTrT = tf.tensor1d(ytr.map(v => +v), 'float32');
      yTeT = tf.tensor1d(yte.map(v => +v), 'float32');
    } else {
      yTrT = tf.tensor1d(ytr, 'float32');
      yTeT = tf.tensor1d(yte, 'float32');
    }
    return { xTr, xTe, yTrT, yTeT, isSeq };
  }

  /* =========================
   * Explainability (模型不可知)
   * ========================= */

  function getFeatureSpans(meta){
    const spans = {}; let offset = 0;
    for (const c of meta.featureCols){
      if (meta.colTypes[c] === 'numeric'){ spans[c] = [offset, offset+1]; offset += 1; }
      else {
        const dim = meta.catDims?.[c] ?? Object.keys(meta.catMaps?.[c] || {}).length;
        spans[c] = [offset, offset+dim]; offset += dim;
      }
    }
    return { spans, totalDim: offset };
  }

  function _score(yTrue, yPred, task){
    if (task === 'classification'){
      let correct = 0; for (let i=0;i<yTrue.length;i++) if (yTrue[i] === yPred[i]) correct++;
      return correct / yTrue.length;
    } else {
      let sse = 0; for (let i=0;i<yTrue.length;i++){ const d = yTrue[i]-yPred[i]; sse += d*d; }
      const rmse = Math.sqrt(sse / yTrue.length);
      return -rmse; // 越大越好（負的 RMSE）
    }
  }

  function _predict(kind, model, X, task){
    if (kind === 'tf'){
      const t = tf.tensor2d(X, undefined, 'float32');
      const out = model.predict(t);
      const arr = out.arraySync();
      t.dispose(); out.dispose?.();
      if (task === 'classification'){
        return arr.map(v => Array.isArray(v)
          ? (v.length > 1 ? v.indexOf(Math.max(...v)) : (v[0] > 0.5 ? 1 : 0))
          : (v > 0.5 ? 1 : 0));
      } else {
        return arr.map(v => Array.isArray(v) ? v[0] : v);
      }
    } else {
      return model.predict(X);
    }
  }

  function permutationImportance(X, y, meta, model, kind, task, { sampleSize=1000, repeats=1, seed=42 } = {}){
    const n = X.length; if (!n) return { baseScore: 0, items: [] };
    const idx = Array.from({length:n}, (_,i)=>i);
    let s = seed>>>0; for (let i=idx.length-1;i>0;i--){ s=(1103515245*s+12345)>>>0; const j=s%(i+1); [idx[i],idx[j]]=[idx[j],idx[i]]; }
    const take = Math.min(sampleSize, n);
    const subIdx = idx.slice(0, take);
    const Xs = subIdx.map(i => X[i].slice());
    const ys = subIdx.map(i => y[i]);

    const basePred = _predict(kind, model, Xs, task);
    const base = _score(ys, basePred, task);

    const { spans } = getFeatureSpans(meta);
    const importances = [];
    for (const [col,[st,ed]] of Object.entries(spans)){
      const colIdxs = []; for (let j=st;j<ed;j++) colIdxs.push(j);
      let dropSum = 0;
      for (let r=0;r<repeats;r++){
        // 列亂序
        const p = Array.from({length:take}, (_,i)=>i);
        for (let i=p.length-1;i>0;i--){ s=(1103515245*s+12345)>>>0; const j=s%(i+1); [p[i],p[j]]=[p[j],p[i]]; }
        // 保存並打散
        const saved = colIdxs.map(() => new Array(take));
        for (let k=0;k<colIdxs.length;k++){
          const c = colIdxs[k];
          for (let i=0;i<take;i++){ saved[k][i] = Xs[i][c]; }
          for (let i=0;i<take;i++){ Xs[i][c] = saved[k][p[i]]; }
        }
        const pred = _predict(kind, model, Xs, task);
        dropSum += (base - _score(ys, pred, task));
        // 還原
        for (let k=0;k<colIdxs.length;k++){
          const c = colIdxs[k];
          for (let i=0;i<take;i++){ Xs[i][c] = saved[k][i]; }
        }
      }
      const imp = Math.max(0, dropSum / repeats);
      importances.push({ col, importance: imp });
    }
    const maxImp = Math.max(1e-12, ...importances.map(d=>d.importance));
    importances.forEach(d => d.norm = d.importance / maxImp);
    importances.sort((a,b)=> b.importance - a.importance);
    return { baseScore: base, items: importances };
  }

  function buildModelChoiceText({ task, bestType, bestKind, bestScore, trail }){
    const metricName = (task === 'classification') ? '驗證準確率' : '驗證 RMSE';
    if (Array.isArray(trail) && trail.length){
      const sorted = trail.slice().sort((a,b)=> (task==='classification') ? (b.score-a.score) : (a.score-b.score));
      const top = sorted.slice(0, 5).map((t,i)=>`${i+1}. ${t.kind}/${t.type} → ${ (task==='classification') ? t.score.toFixed(4) : ('RMSE '+Math.abs(t.score).toFixed(6)) }`);
      return `Auto 候選比較（前 5）：\n${top.join('\n')}\n最佳：${bestKind}/${bestType}，${metricName} ${(task==='classification') ? bestScore.toFixed(4) : ('RMSE '+Math.abs(bestScore).toFixed(6))}`;
    }
    return `選擇 ${bestKind}/${bestType}，因其在驗證集的${metricName}最佳（${(task==='classification') ? bestScore.toFixed(4) : ('RMSE '+Math.abs(bestScore).toFixed(6))}）。`;
  }

  function buildPreprocessText(meta){
    const normX = meta.normalize ? 'MinMax 正規化' : 'Z-score 標準化';
    const tgt = (meta.task === 'regression' && meta.normalizeTarget) ? `；目標值以均值 ${meta.yMean?.toFixed?.(4)}、標準差 ${meta.yStd?.toFixed?.(4)} 標準化` : '';
    const cols = meta.featureCols.map(c => `${c}(${meta.colTypes[c]})`).join('、 ');
    return `輸入特徵：${cols}。數值特徵採 ${normX}；類別特徵以 One-Hot 編碼${tgt}。目標欄位：${meta.targetCol}（任務：${meta.task}）。`;
  }

  function ensureExplainUI(){
    if (document.getElementById('explainCard')) return;
    const host = document.getElementById('tab-train') || document.body;
    const card = document.createElement('div');
    card.className = 'card';
    card.id = 'explainCard';
    card.style.marginTop = '12px';
    card.innerHTML = `
      <h3>🔎 可解釋性報告</h3>
      <div id="modelRationale" class="muted" style="white-space:pre-line"></div>
      <h4 style="margin-top:10px;">⭐ 重要特徵（Permutation Importance）</h4>
      <table id="featureImpTable"><thead><tr><th>特徵</th><th>重要度</th><th>相對值</th></tr></thead><tbody></tbody></table>
    `;
    host.appendChild(card);
  }

  function renderFeatureImportanceTable(items){
    const tbody = document.querySelector('#featureImpTable tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    const top = items.slice(0, 20);
    for (const d of top){
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${d.col}</td><td>${d.importance.toFixed(6)}</td><td>${(d.norm*100).toFixed(1)}%</td>`;
      tbody.appendChild(tr);
    }
  }

  async function buildExplainabilityReport({ Xte, yte, meta, model, kind, trail }){
    ensureExplainUI();
    const sampleSize = Math.min(1000, Xte.length);
    const { baseScore, items } = permutationImportance(Xte, yte, meta, model, kind, meta.task, { sampleSize, repeats: 1 });
    const txt = buildModelChoiceText({
      task: meta.task,
      bestType: meta.modelType,
      bestKind: kind,
      bestScore: (meta.task==='classification') ? baseScore : Math.abs(baseScore),
      trail
    }) + '\n' + buildPreprocessText(meta);
    const box = document.getElementById('modelRationale'); if (box) box.textContent = txt;
    renderFeatureImportanceTable(items);
    // 寫回 meta 便於輸出 metadata.json
    meta.explain = {
      task: meta.task,
      modelType: meta.modelType,
      rationale: txt,
      baseScore,
      importances: items.slice(0, 10),
      preprocess: {
        normalize: meta.normalize,
        normalizeTarget: !!meta.normalizeTarget,
        targetCol: meta.targetCol,
        featureCols: meta.featureCols,
        colTypes: meta.colTypes
      }
    };
  }

  /* =========================
   * Trainers
   * ========================= */

  // AutoML：同時嘗試 TF.js 與 MLBundle；只保留目前最佳（即時釋放較差者）
  async function trainAutoML({ Xtr, ytr, Xte, yte, meta, lr, scheduleType, epochs, batchSize }) {
    if (!AML.state?.charts) AML.resetCharts(meta.task === 'classification');

    const candidates = AML.AUTO_MODEL_CANDIDATES[meta.task] || [];
    let bestScore = meta.task === 'classification' ? 0 : Infinity;
    let bestModel = null;
    let bestModelType = null;
    let bestKind = null; // 'tf' | 'ml'
    const trail = [];

    for (const modelType of candidates) {
      const isTraditional = !!AML.ML_MODEL_MAP[modelType];

      clearCharts(meta.task === 'classification');
      $('bestMetric').textContent = '—';
      $('finalMetric').textContent = '—';

      setStatus(`AutoML 嘗試模型：${modelType}`);

      if (isTraditional) {
        const spec = AML.ML_MODEL_MAP[modelType];
        const ctorName = (meta.task === 'regression') ? spec.reg : spec.cls;
        if (!ctorName) { safeLog(`跳過 ${modelType}：不支援 ${meta.task}`); continue; }
        if (!window.MLBundle || !MLBundle[ctorName]) { safeLog(`跳過 ${modelType}：MLBundle.${ctorName} 不存在`); continue; }

        const params = { task: meta.task };
        if (['tree', 'rf'].includes(modelType)) {
          const md = parseInt($('maxDepth')?.value, 10);
          const mss = parseInt($('minSamplesSplit')?.value, 10);
          if (Number.isFinite(md)) params.maxDepth = md;
          if (Number.isFinite(mss)) params.minSamplesSplit = mss;
          if (modelType === 'rf') {
            const ne = parseInt($('nEstimators')?.value, 10);
            if (Number.isFinite(ne)) params.nEstimators = ne;
          }
        }

        let candidate = null;
        try { candidate = new MLBundle[ctorName](Xtr, ytr, params); }
        catch (e) { console.warn(`傳統模型 ${modelType} 建立失敗：`, e?.message); candidate = null; }
        if (!candidate) continue;

        let candidateScore;
        if (meta.task === 'classification') {
          const pred = candidate.predict(Xte);
          const acc = pred.filter((p, i) => p === yte[i]).length / yte.length;
          candidateScore = acc;
        } else {
          const pred = candidate.predict(Xte);
          const mse = yte.reduce((s, yv, i) => s + Math.pow(yv - pred[i], 2), 0) / yte.length;
          candidateScore = mse;
        }

        trail.push({ kind: 'ml', type: modelType, score: candidateScore });

        const isBetter = meta.task === 'classification'
          ? (candidateScore > bestScore)
          : (candidateScore < bestScore);

        if (isBetter) {
          if (bestKind === 'tf' && bestModel?.dispose) { try { bestModel.dispose(); } catch(_){} }
          bestModel = candidate; bestModelType = modelType; bestScore = candidateScore; bestKind = 'ml';
        } // 傳統模型交給 GC

      } else {
        const model = _withUniqueModelName(`auto_${modelType}`, () =>
          AML.makeModel(
            Xtr[0].length,
            meta.task,
            modelType,
            (meta.labelInfo?.classes.length || 2),
            lr,
            scheduleType,
            epochs
          )
        );

        const { xTr, xTe, yTrT, yTeT } = tensorsFor(modelType, Xtr, Xte, ytr, yte, meta.task);
        let currentBest = meta.task === 'classification' ? 0 : Infinity;
        const lrCb = AML.getLRSchedulerCallback(model, lr, scheduleType, epochs, { stepSize: 10, gamma: 0.5, expK: 0.05 });

        try {
          await model.fit(xTr, yTrT, {
            epochs, batchSize, shuffle: true, validationData: [xTe, yTeT], verbose: 0,
            callbacks: [lrCb, {
              onEpochEnd: (epoch, logs) => {
                AML.state.charts.loss.data.labels.push(AML.state.charts.loss.data.labels.length + 1);
                AML.state.charts.loss.data.datasets[0].data.push(logs.loss);
                AML.state.charts.loss.data.datasets[1].data.push(logs.val_loss);
                AML.state.charts.loss.update();

                if (meta.task === 'classification' && (logs.val_accuracy !== undefined || logs.val_acc !== undefined)) {
                  const acc = logs.val_accuracy ?? logs.val_acc ?? 0;
                  AML.state.charts.acc.data.labels.push(AML.state.charts.acc.data.labels.length + 1);
                  AML.state.charts.acc.data.datasets[0].data.push(acc);
                  AML.state.charts.acc.update();
                  if (acc > currentBest) currentBest = acc;
                  $('bestMetric').textContent = `Best Val Acc = ${currentBest.toFixed(4)}`;
                  $('finalMetric').textContent = `Val Acc = ${(acc ?? 0).toFixed(4)}`;
                } else {
                  const cur = logs.val_loss ?? logs.loss;
                  if (cur < currentBest) currentBest = cur;
                  $('bestMetric').textContent = `Best Val MSE = ${currentBest.toFixed(6)} (RMSE=${Math.sqrt(currentBest).toFixed(6)})`;
                  $('finalMetric').textContent = `Val MSE = ${cur.toFixed(6)} (RMSE=${Math.sqrt(cur).toFixed(6)})`;
                }

                const curLR = typeof lrCb.getCurrentLR === 'function' ? lrCb.getCurrentLR() : null;
                if (curLR != null) {
                  AML.state.charts.lr.data.labels.push(epoch + 1);
                  AML.state.charts.lr.data.datasets[0].data.push(curLR);
                  AML.state.charts.lr.update();
                }
                setStatus(`訓練中（${modelType}）：Epoch ${epoch + 1}/${epochs}`);
              }
            }]
          });
        } catch (err) {
          console.error(`❌ 模型 ${modelType} 訓練錯誤：${err.message}`);
          model.dispose(); xTr.dispose(); yTrT.dispose(); xTe.dispose(); yTeT.dispose();
          continue;
        }

        const candidateScore = currentBest;
        trail.push({ kind: 'tf', type: modelType, score: candidateScore });

        const isBetter = meta.task === 'classification'
          ? (candidateScore > bestScore)
          : (candidateScore < bestScore);

        if (isBetter) {
          if (bestKind === 'tf' && bestModel?.dispose) { try { bestModel.dispose(); } catch(_){} }
          bestModel = model; bestModelType = modelType; bestScore = candidateScore; bestKind = 'tf';
        } else {
          model.dispose();
        }

        xTr.dispose(); yTrT.dispose(); xTe.dispose(); yTeT.dispose();
      }
    }

    if (!bestModel) throw new Error('AutoML 無可用模型');

    $('bestMetric').textContent =
      meta.task === 'classification'
        ? `Best Val Accuracy: ${(Number(bestScore) || 0).toFixed(4)}`
        : `Best Val MSE: ${(Number(bestScore) || 0).toFixed(6)}`;
    $('finalMetric').textContent = `使用模型：${bestModelType}`;
    setStatus(`✅ 進階 AutoML 選出最佳模型：${bestModelType} (${bestKind})`);

    return { bestModel, bestModelType, bestScore, bestKind, trail };
  }

  // 傳統 ML 評估（改為 async：結束時一併產生可解釋性報告）
  async function evaluateTraditional({ modelSel, Xte, yte, task, traditionalModel, meta }) {
    if (task === 'classification') {
      const pred = traditionalModel.predict(Xte);
      const acc = pred.filter((p, i) => p === yte[i]).length / yte.length;

      $('bestMetric').textContent = `Accuracy = ${acc.toFixed(4)}`;
      $('finalMetric').textContent = `Test Accuracy = ${acc.toFixed(4)}`;

      const labels = [...new Set(yte)];
      const toIdx = new Map(labels.map((l, i) => [l, i]));
      const cm = Array(labels.length).fill(0).map(() => Array(labels.length).fill(0));
      yte.forEach((t, i) => { const ti = toIdx.get(t), pi = toIdx.get(pred[i]); if (ti != null && pi != null) cm[ti][pi]++; });
      AML.renderConfusionMatrix('confusionMatrixCanvas', cm, labels);

      const metrics = AML.calcClassificationMetrics(yte, pred, labels);
      AML.renderMetricsTable('metricsTable', metrics);

      if (labels.length === 2 && traditionalModel.predictProba) {
        const probs = traditionalModel.predictProba(Xte).map(v => v[1]);
        const { fpr, tpr, auc } = AML.calcROC(yte, probs);
        AML.renderROC('rocCanvas', fpr, tpr, auc);
      }
    } else {
      const pred = traditionalModel.predict(Xte);
      const mse = yte.reduce((s, yv, i) => s + Math.pow(yv - pred[i], 2), 0) / yte.length;
      const rmse = Math.sqrt(mse);
      $('bestMetric').textContent = `MSE = ${mse.toFixed(6)} | RMSE = ${rmse.toFixed(6)}`;
      $('finalMetric').textContent = `Test MSE = ${mse.toFixed(6)} | Test RMSE = ${rmse.toFixed(6)}`;
    }

    setStatus('✅ 傳統 ML 訓練完成');

    // 👉 訓練結束一律產生報告
    await buildExplainabilityReport({ Xte, yte, meta, model: traditionalModel, kind: 'ml' });

    enableButtons({ tfModel: null, traditionalModel: true });
  }

  async function trainTFJS({ modelSel, Xtr, ytr, Xte, yte, meta, lr, scheduleType, epochs, batchSize }) {
    setStatus('訓練 TF.js 模型中…');

    const inDim = Xtr[0].length;
    const nClasses = meta.task === 'classification' ? (meta.labelInfo?.classes?.length || 2) : 1;

    AML.state.tfModel?.dispose?.();
    AML.state.traditionalModel = null;
    AML.state.tfModel = _withUniqueModelName(`tf_${modelSel}`, () =>
      AML.makeModel(inDim, meta.task, modelSel, nClasses, lr, scheduleType, epochs)
    );

    const xTr = tf.tensor2d(Xtr, undefined, 'float32');
    const xTe = tf.tensor2d(Xte, undefined, 'float32');
    const yTrT = meta.task === 'classification' ? tf.tensor1d(ytr.map(v => +v), 'float32') : tf.tensor1d(ytr, 'float32');
    const yTeT = meta.task === 'classification' ? tf.tensor1d(yte.map(v => +v), 'float32') : tf.tensor1d(yte, 'float32');

    let best = meta.task === 'classification' ? 0 : Number.POSITIVE_INFINITY;
    const lrCb = AML.getLRSchedulerCallback(AML.state.tfModel, lr, scheduleType, epochs, { stepSize: 10, gamma: 0.5, expK: 0.05 });

    await AML.state.tfModel.fit(xTr, yTrT, {
      epochs, batchSize, shuffle: true, validationData: [xTe, yTeT],
      callbacks: [lrCb, {
        onEpochEnd: (epoch, logs) => {
          AML.state.charts.loss.data.labels.push(AML.state.charts.loss.data.labels.length + 1);
          AML.state.charts.loss.data.datasets[0].data.push(logs.loss);
          AML.state.charts.loss.data.datasets[1].data.push(logs.val_loss);
          AML.state.charts.loss.update();

          if (meta.task === 'classification' && (logs.val_accuracy !== undefined || logs.val_acc !== undefined)) {
            const acc = logs.val_accuracy ?? logs.val_acc ?? 0;
            AML.state.charts.acc.data.labels.push(AML.state.charts.acc.data.labels.length + 1);
            AML.state.charts.acc.data.datasets[0].data.push(acc);
            AML.state.charts.acc.update();
            if (acc > best) best = acc;
            $('bestMetric').textContent = `Best Val Acc = ${best.toFixed(4)}`;
            $('finalMetric').textContent = `Val Acc = ${(acc ?? 0).toFixed(4)}`;
          } else {
            const cur = logs.val_loss ?? logs.loss;
            if (cur < best) best = cur;
            $('bestMetric').textContent = `Best Val MSE = ${best.toFixed(6)} (RMSE=${Math.sqrt(best).toFixed(6)})`;
            $('finalMetric').textContent = `Val MSE = ${cur.toFixed(6)} (RMSE=${Math.sqrt(cur).toFixed(6)})`;
          }

          const curLR = typeof lrCb.getCurrentLR === 'function' ? lrCb.getCurrentLR() : null;
          if (curLR != null) {
            AML.state.charts.lr.data.labels.push(epoch + 1);
            AML.state.charts.lr.data.datasets[0].data.push(curLR);
            AML.state.charts.lr.update();
          }
          setStatus(`訓練中…（Epoch ${epoch + 1}/${epochs}）`);
        },
        onTrainEnd: async () => {
          // 評估 + 圖表
          const yTrue = yTeT.arraySync();
          const yPredProb = AML.state.tfModel.predict(xTe).arraySync();
          const yPred = yPredProb.map(v =>
            Array.isArray(v)
              ? (v.length > 1 ? v.indexOf(Math.max(...v)) : (v[0] > 0.5 ? 1 : 0))
              : (v > 0.5 ? 1 : 0)
          );

          if (meta.task === 'classification') {
            const classes = [...new Set(yTrue)];
            const toIdx = new Map(classes.map((c, i) => [c, i]));
            const cm = Array(classes.length).fill(0).map(() => Array(classes.length).fill(0));
            yTrue.forEach((t, i) => { const r = toIdx.get(t), c = toIdx.get(yPred[i]); if (r != null && c != null) cm[r][c]++; });
            AML.renderConfusionMatrix('confusionMatrixCanvas', cm, classes);
            const metrics = AML.calcClassificationMetrics(yTrue, yPred, classes);
            AML.renderMetricsTable('metricsTable', metrics);
            if (classes.length === 2) {
              const probs = yPredProb.map(v => Array.isArray(v) ? (v.length > 1 ? v[1] : v[0]) : v);
              const { fpr, tpr, auc } = AML.calcROC(yTrue, probs);
              AML.renderROC('rocCanvas', fpr, tpr, auc);
            }
          }

          const summaryText = AML.getModelSummaryText(AML.state.tfModel);
          $('summaryText').textContent = summaryText;
          $('modelSummary').style.display = 'block';

          // 👉 訓練結束一律產生報告
          await buildExplainabilityReport({ Xte, yte, meta, model: AML.state.tfModel, kind: 'tf' });

          setStatus('✅ 訓練完成（TF.js）');
          enableButtons({ tfModel: true, traditionalModel: false });
        }
      }]
    });

    xTr.dispose(); xTe.dispose(); yTrT.dispose(); yTeT.dispose();
  }

  /* =========================
   * Entry
   * ========================= */

  AML.attachTrainingHandlers = function () {
    if (AML._trainHandlersAttached) return;
    AML._trainHandlersAttached = true;

    const trainBtn = $('trainBtn');

    trainBtn?.addEventListener('click', async () => {
      try {
        if (!AML.state.rawData.length) { alert('請先到「載入資料」頁上傳 CSV'); return; }

        const ui = readTrainingUI();
        if (!ui.target) { alert('請選擇目標欄位'); return; }

        preflightDataset(AML.state.rawData);

        setStatus('資料前處理中…');
        const prepOut = AML.prepareXY(AML.state.rawData, ui.target, ui.normalize);
        if (!prepOut || !Array.isArray(prepOut.X) || prepOut.X.length === 0) {
          throw new Error('特徵轉換後為空，請檢查變數使用設定與 CSV 表頭。');
        }
        const { X, y, meta: prep } = prepOut;
        AML.state.meta = { ...prep, modelType: ui.modelSel };

        const parts = splitDataset(X, y, ui.ratio);
        const isTraditional = Object.keys(AML.ML_MODEL_MAP).includes(ui.modelSel);
        resetMetricsUI(!isTraditional && AML.state.meta.task === 'classification');

        // ===== A) AutoML：同時比較 TF.js + MLBundle。訓練後一律產生報告 =====
        if (ui.modelSel === 'auto') {
          try { AML.state.tfModel?.dispose?.(); } catch (_) {}
          AML.state.tfModel = null; AML.state.traditionalModel = null;

          const { bestModel, bestModelType, bestScore, bestKind, trail } = await trainAutoML({
            Xtr: parts.Xtr, ytr: parts.ytr, Xte: parts.Xte, yte: parts.yte,
            meta: AML.state.meta, lr: ui.lr, scheduleType: ui.scheduleType, epochs: ui.epochs, batchSize: ui.batchSize
          });

          if (bestKind === 'tf') {
            AML.state.tfModel = bestModel;
            AML.state.traditionalModel = null;

            const summaryText = AML.getModelSummaryText(AML.state.tfModel);
            $('summaryText').textContent = summaryText;
            $('modelSummary').style.display = 'block';

            $('bestMetric').textContent =
              AML.state.meta.task === 'classification'
                ? `Best Val Accuracy: ${(Number(bestScore) || 0).toFixed(4)}`
                : `Best Val MSE: ${(Number(bestScore) || 0).toFixed(6)}`;
            $('finalMetric').textContent = `使用模型：${bestModelType}`;

            AML.state.meta.modelType = bestModelType;

            // 👉 產生報告（有 trail）
            await buildExplainabilityReport({
              Xte: parts.Xte, yte: parts.yte, meta: AML.state.meta,
              model: AML.state.tfModel, kind: 'tf', trail
            });

            enableButtons({ tfModel: true, traditionalModel: false });
          } else {
            AML.state.traditionalModel = bestModel;
            AML.state.tfModel?.dispose?.();
            AML.state.tfModel = null;
            AML.state.meta.modelType = bestModelType;

            // 用最佳傳統模型畫指標 + 👉 產生報告
            await evaluateTraditional({
              modelSel: bestModelType,
              Xte: parts.Xte,
              yte: parts.yte,
              task: AML.state.meta.task,
              traditionalModel: AML.state.traditionalModel,
              meta: AML.state.meta
            });
          }

          setStatus(`✅ 進階 AutoML 選出最佳模型：${bestModelType}（${bestKind}）`);
          return;
        }

        // ===== B) 單一傳統 ML（結束一律產生報告） =====
        if (isTraditional) {
          const spec = AML.ML_MODEL_MAP[ui.modelSel];
          const ctorName = (AML.state.meta.task === 'regression') ? spec.reg : spec.cls;
          const params = { task: AML.state.meta.task };
          if (['tree', 'rf'].includes(ui.modelSel)) {
            params.maxDepth = parseInt($('maxDepth')?.value, 10);
            params.minSamplesSplit = parseInt($('minSamplesSplit')?.value, 10);
            if (ui.modelSel === 'rf') params.nEstimators = parseInt($('nEstimators')?.value, 10);
          }
          if (!ctorName) throw new Error(`${ui.modelSel} 不支援 ${AML.state.meta.task} 任務`);
          if (!window.MLBundle || !MLBundle[ctorName]) throw new Error(`MLBundle.${ctorName} 不存在`);

          AML.state.tfModel?.dispose?.();
          AML.state.tfModel = null;
          AML.state.traditionalModel = new MLBundle[ctorName](parts.Xtr, parts.ytr, params);

          await evaluateTraditional({
            modelSel: ui.modelSel,
            Xte: parts.Xte,
            yte: parts.yte,
            task: AML.state.meta.task,
            traditionalModel: AML.state.traditionalModel,
            meta: AML.state.meta
          });
          return;
        }

        // ===== C) 指定 TF.js 模型（結束一律產生報告） =====
        await trainTFJS({
          modelSel: ui.modelSel,
          Xtr: parts.Xtr, ytr: parts.ytr, Xte: parts.Xte, yte: parts.yte,
          meta: AML.state.meta, lr: ui.lr, scheduleType: ui.scheduleType, epochs: ui.epochs, batchSize: ui.batchSize
        });

      } catch (err) {
        console.error(err);
        setStatus('❌ 訓練失敗：' + err.message);
      }
    });
  };
})();
