// 95_config.js (final, clean, single IIFE)
(function(){
  const AML = window.AML;
  AML.state = AML.state || {};
  const $ = (id)=>document.getElementById(id);

  /* =========================
   * Tabs
   * ========================= */
  AML.attachTabs = function(){
    if (AML._tabsWired) return;
    AML._tabsWired = true;

    const tabs = document.querySelectorAll('.tab');
    const views = {
      data: document.getElementById('tab-data'),
      config: document.getElementById('tab-config'),
      train: document.getElementById('tab-train'),
      predict: document.getElementById('tab-predict'),
      glossary: document.getElementById('tab-glossary')
    };
    tabs.forEach(tab => {
      tab.addEventListener('click', ()=>{
        tabs.forEach(t => t.classList.remove('active')); tab.classList.add('active');
        const key = tab.getAttribute('data-tab');
        Object.entries(views).forEach(([k,el])=> el?.classList.toggle('hidden', k !== key));
      });
    });
  };

  /* =========================
   * Helpers: type inference & values
   * ========================= */
  function inferColumnType(rows, colName, k = 200){
    const sample = rows.slice(0, k).map(r => r[colName]);
    const numCount = sample.filter(AML.isNumeric).length;
    return (numCount === sample.length) ? 'numeric' : 'category';
  }
  function getValues(rows, col, type){
    if (type === 'numeric'){
      return rows.map(r => {
        const v = parseFloat(r[col]); return Number.isFinite(v) ? v : NaN;
      });
    } else {
      return rows.map(r => (r[col] ?? '').toString());
    }
  }

  /* =========================
   * Helpers: association metrics
   * ========================= */
  function pearson(x, y){
    const xs = [], ys = [];
    for (let i=0;i<x.length;i++){
      const xi = x[i], yi = y[i];
      if (Number.isFinite(xi) && Number.isFinite(yi)){ xs.push(xi); ys.push(yi); }
    }
    const n = xs.length; if (n < 2) return 0;
    const mx = xs.reduce((a,b)=>a+b,0)/n, my = ys.reduce((a,b)=>a+b,0)/n;
    let num=0, dx2=0, dy2=0;
    for (let i=0;i<n;i++){ const dx=xs[i]-mx, dy=ys[i]-my; num+=dx*dy; dx2+=dx*dx; dy2+=dy*dy; }
    const den = Math.sqrt(dx2*dy2); return den>0 ? (num/den) : 0;
  }
  function corrRatio(categories, values){
    const pairs = [];
    for (let i=0;i<categories.length;i++){ const v = values[i]; if (Number.isFinite(v)) pairs.push([categories[i] ?? '', v]); }
    const n = pairs.length; if (!n) return 0;
    const byCat = new Map(); let mean = 0;
    for (const [c,v] of pairs){ mean += v; if (!byCat.has(c)) byCat.set(c, []); byCat.get(c).push(v); }
    mean /= n;
    let ssBetween = 0, ssTotal = 0;
    for (const arr of byCat.values()){
      const m = arr.reduce((a,b)=>a+b,0)/arr.length;
      ssBetween += arr.length * Math.pow(m-mean,2);
      for (const v of arr){ ssTotal += Math.pow(v-mean,2); }
    }
    return ssTotal>0 ? Math.sqrt(ssBetween/ssTotal) : 0;
  }
  function cramersV(a, b){
    const n = a.length;
    const mapA = new Map(), mapB = new Map();
    let r=0,c=0;
    for (let i=0;i<n;i++){
      const va = (a[i] ?? '').toString(), vb = (b[i] ?? '').toString();
      if (!mapA.has(va)) mapA.set(va, r++);
      if (!mapB.has(vb)) mapB.set(vb, c++);
    }
    if (r<2 || c<2) return 0;
    const table = Array.from({length:r}, ()=>Array(c).fill(0));
    let N=0;
    for (let i=0;i<n;i++){
      const va = (a[i] ?? '').toString(), vb = (b[i] ?? '').toString();
      table[mapA.get(va)][mapB.get(vb)]++; N++;
    }
    if (N===0) return 0;
    const rowSum = table.map(row => row.reduce((s,x)=>s+x,0));
    const colSum = Array.from({length:c}, (_,j)=> table.reduce((s,row)=>s+row[j],0));
    let chi2 = 0;
    for (let i=0;i<r;i++) for (let j=0;j<c;j++){
      const E = rowSum[i]*colSum[j]/N; if (E>0){ const diff = table[i][j]-E; chi2 += (diff*diff)/E; }
    }
    const k = Math.min(r-1,c-1); return k>0 ? Math.sqrt(chi2/(N*k)) : 0;
  }

  function computeAssociations(rows, columns, target, types){
    if (!rows?.length || !columns?.length || !target) return [];
    const tType = types[target] || inferColumnType(rows, target);
    const y = getValues(rows, target, tType);
    const out = [];
    for (const col of columns){
      if (col === target) continue;
      const fType = types[col] || inferColumnType(rows, col);
      const x = getValues(rows, col, fType);
      let coeffName = '', value = 0, nUsed = 0;
      if (fType==='numeric' && tType==='numeric'){
        coeffName = 'Pearson r'; value = pearson(x, y); nUsed = Math.min(x.length, y.length);
      } else if (fType==='category' && tType==='numeric'){
        coeffName = 'η'; value = corrRatio(x, y); nUsed = y.filter(Number.isFinite).length;
      } else if (fType==='numeric' && tType==='category'){
        coeffName = 'η'; value = corrRatio(y, x); nUsed = x.filter(Number.isFinite).length;
      } else {
        coeffName = "Cramér's V"; value = cramersV(x, y); nUsed = x.length;
      }
      out.push({ col, featureType: fType, targetType: tType, coeffName, value, abs: Math.abs(value), nUsed });
    }
    out.sort((a,b)=> b.abs - a.abs);
    return out;
  }

  function readVarTableState(tbody){
    const state = {};
    tbody?.querySelectorAll('tr')?.forEach(tr=>{
      const col = tr.dataset.col || tr.cells?.[0]?.textContent?.trim();
      const sel = tr.querySelector('select');
      const chk = tr.querySelector('input[type="checkbox"]');
      if (col) state[col] = { type: sel?.value, use: !!chk?.checked };
    });
    return state;
  }

  function buildVarTableWithAssoc(tbody, columns, rows, target, prevState){
    const types = {};
    for (const c of columns){ types[c] = prevState?.[c]?.type || inferColumnType(rows, c); }

    const assoc = computeAssociations(rows, columns, target, types);
    const assocMap = Object.fromEntries(assoc.map(d => [d.col, d]));

    tbody.innerHTML = '';
    const features = columns.filter(c => c !== target)
      .sort((a,b)=> (assocMap[b]?.abs||0) - (assocMap[a]?.abs||0));

    for (const c of features){
      const tr = document.createElement('tr'); tr.dataset.col = c;

      const nameTd = document.createElement('td'); nameTd.textContent = c; tr.appendChild(nameTd);

      const typeTd = document.createElement('td');
      const sel = document.createElement('select');
      sel.innerHTML = `<option value="numeric">數值</option><option value="category">類別</option>`;
      sel.value = types[c];
      typeTd.appendChild(sel); tr.appendChild(typeTd);

      const featTd = document.createElement('td');
      const chk = document.createElement('input'); chk.type = 'checkbox';
      chk.checked = prevState?.[c]?.use ?? true;
      featTd.appendChild(chk); tr.appendChild(featTd);

      const coeffTd = document.createElement('td');
      const info = assocMap[c];
      coeffTd.textContent = info ? `${info.coeffName} = ${(Number(info.value)||0).toFixed(6)}` : '—';
      coeffTd.title = info ? `樣本=${info.nUsed}` : '';
      tr.appendChild(coeffTd);

      tbody.appendChild(tr);
    }

    AML.state = AML.state || {};
    AML.state.associations = assoc;
  }

  /* =========================
   * One-time global ML params wiring (show/hide panel by selected model)
   * ========================= */
  if (!AML._configWireOnce) {
    AML._configWireOnce = true;

    function showMLParams(model){
      const box = $('mlParams'); if (!box) return;             // 若沒放對應 HTML，安全跳過
      const map = { tree:'tree', rf:'rf', knn:'knn', svm:'svm', nb:'nb' };
      const key = map[model] || null;

      const inPreset = (AML.state?.mode === 'preset');
      box.classList.toggle('hidden', !inPreset || !key);

      ['tree','rf','knn','svm','nb'].forEach(k=>{
        const el = $('params_'+k);
        if (el) el.classList.toggle('hidden', k !== key);
      });

      const metric = $('knnMetric')?.value;
      $('knnPWrap')?.classList.toggle('hidden', metric !== 'minkowski');
    }
    AML.showMLParams = showMLParams; // optional: 給外部可呼叫

    $('modelModeGroup')?.addEventListener('click', (e)=>{
      const btn = e.target.closest('.mode-btn'); if (!btn) return;
      document.querySelectorAll('#modelModeGroup .mode-btn').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      AML.state.mode = btn.dataset.mode || 'auto';
      showMLParams(AML.state?.selectedModel);
    });

    $('presetModels')?.addEventListener('click', (e)=>{
      const card = e.target.closest('[data-model]'); if (!card) return;
      AML.state = AML.state || {};
      AML.state.selectedModel = card.dataset.model;
      showMLParams(AML.state.selectedModel);
    });

    $('knnMetric')?.addEventListener('change', ()=>{
      const metric = $('knnMetric').value;
      $('knnPWrap')?.classList.toggle('hidden', metric !== 'minkowski');
    });
  }

  /* =========================
   * Data loader (CSV + Target + Feature table with associations)
   * ========================= */
  AML.attachDataLoader = function(){
    const trainCsv = document.getElementById('trainCsv');
    const trainPreview = document.getElementById('trainPreview');
    const targetSelect = document.getElementById('targetSelect');
    const varTable = document.getElementById('varTable');
    const varTbody = varTable?.querySelector('tbody');

    // 確保表頭新增第 4 欄
    const headRow = varTable?.querySelector('thead tr');
    if (headRow && headRow.children.length < 4){
      const th = document.createElement('th'); th.textContent = '與目標關係';
      headRow.appendChild(th);
    }
    // 未選目標前隱藏表格
    if (varTable) varTable.style.display = 'none';

    function resetTargetSelect(cols){
      targetSelect.innerHTML = '<option value="">請選擇目標欄位</option>';
      cols.forEach(c => {
        const opt = document.createElement('option'); opt.value = c; opt.textContent = c;
        targetSelect.appendChild(opt);
      });
    }

    // 載入 CSV
    trainCsv?.addEventListener('change', (e)=>{
      const file = e.target.files?.[0]; if (!file) return;
      Papa.parse(file, {
        header:true, skipEmptyLines:true, complete: (res)=>{
          AML.state = AML.state || {};
          AML.state.rawData = res.data || [];
          AML.state.columns = res.meta?.fields?.length ? res.meta.fields : Object.keys(AML.state.rawData[0] || {});
          resetTargetSelect(AML.state.columns);
          if (varTbody) varTbody.innerHTML = '';
          if (varTable) varTable.style.display = 'none';
          if (trainPreview) trainPreview.textContent = `已載入：${file.name}（${AML.state.rawData.length} 行 × ${AML.state.columns.length} 欄）`;
          const metaBtn = document.getElementById('downloadMetaBtn'); if (metaBtn) metaBtn.disabled = false;
        }
      });
    });

    // 選擇 Y 後：顯示表 + 建表（含關係係數）
    targetSelect?.addEventListener('change', ()=>{
      const rows = AML.state?.rawData || []; const cols = AML.state?.columns || [];
      const target = targetSelect.value || '';
      // ✅ 確保 meta 存在並更新 target
      AML.state.meta = AML.state.meta || {};
      AML.state.meta.target = target;
      console.log('📌 已設定 target 欄位 =', AML.state.meta.target);

      if (!rows.length || !cols.length || !target){ if (varTable) varTable.style.display='none'; return; }
      const prev = readVarTableState(varTbody);
      buildVarTableWithAssoc(varTbody, cols, rows, target, prev);
      if (varTable) varTable.style.display = '';
    });

    // 表內改型別 → 重算係數並依新結果重排
    varTbody?.addEventListener('change', (e)=>{
      if (e.target && e.target.tagName === 'SELECT'){
        const rows = AML.state?.rawData || []; const cols = AML.state?.columns || [];
        const target = targetSelect.value || '';
        const prev = readVarTableState(varTbody);
        buildVarTableWithAssoc(varTbody, cols, rows, target, prev);
      }
    });
  };

  /* =========================
   * Load TF.js model + metadata
   * ========================= */
  AML.attachModelLoaders = function(){
    const loadModelBtn = document.getElementById('loadModelBtn');
    const loadStatus = document.getElementById('loadStatus');
    const resetModelBtn = document.getElementById('resetModelBtn');

    resetModelBtn?.addEventListener('click', ()=>{
      try{ if (AML.state.tfModel?.dispose) AML.state.tfModel.dispose(); }catch(_){}
      AML.state.tfModel = null;
      AML.state.traditionalModel = null;
      AML.state.meta = null;
      document.getElementById('predictBtn')?.setAttribute('disabled','');
      document.getElementById('downloadModelBtn')?.setAttribute('disabled','');
      document.getElementById('downloadMLModelBtn')?.setAttribute('disabled','');
      document.getElementById('downloadMetaBtn')?.setAttribute('disabled','');
      if (loadStatus) loadStatus.textContent = '🧹 已清空目前模型與設定，請重新訓練或載入 TF.js 模型 + metadata.json';
      const statusEl = document.getElementById('status'); if (statusEl) statusEl.textContent = '🧹 已清空模型';
    });

    loadModelBtn?.addEventListener('click', async ()=>{
      if (loadStatus) loadStatus.textContent = '讀取中…';
      try{
        const jsonFile = document.getElementById('modelJson')?.files?.[0];
        const binFile  = document.getElementById('modelBin')?.files?.[0];
        const metaFile = document.getElementById('metaJson')?.files?.[0];
        if (!jsonFile) throw new Error('請選擇 model.json');
        if (!binFile) throw new Error('請選擇 .bin 權重檔');
        if (!metaFile) throw new Error('請選擇 metadata.json');
        if (!jsonFile.name.toLowerCase().endsWith('.json')) throw new Error('model.json 檔名不正確');
        if (!binFile.name.toLowerCase().endsWith('.bin')) throw new Error('權重檔需為 .bin');
        if (!metaFile.name.toLowerCase().endsWith('.json')) throw new Error('metadata.json 檔名不正確');

        if (AML.state.tfModel?.dispose) AML.state.tfModel.dispose();
        AML.state.tfModel = await tf.loadLayersModel(tf.io.browserFiles([jsonFile, binFile]));
        const metaText = await metaFile.text();
        const cleaned = metaText.replace(/[\u0000-\u001F\u007F]/g, '');
        const parsed = JSON.parse(cleaned);
        if (!parsed || !parsed.featureCols || !parsed.colTypes) throw new Error('metadata.json 結構不完整');
        AML.state.meta = parsed;
        if (AML.state.meta.normalizeTarget == null) AML.state.meta.normalizeTarget = false;
        if (loadStatus) loadStatus.textContent = '✅ 模型與設定載入完成';
        document.getElementById('predictBtn')?.removeAttribute('disabled');
      }catch(err){
        console.error(err);
        if (loadStatus) loadStatus.textContent = '❌ 載入失敗：' + err.message;
      }
    });
  };

})();
