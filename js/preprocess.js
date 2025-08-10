// 40_preprocess.js
(function(){
  const AML = window.AML;
  const isNumeric = AML.isNumeric, unique = AML.unique;

  /** 建立前處理器：數值統計 + 類別映射（相容原結構，新增 catDims） */
  AML.buildPreprocessorCustom = function(data, _target, featureCols, colTypes, normalize=true){
    const catMaps = {}, numStats = {}, catDims = {};
    // ===== 數值特徵統計 =====
    for (const c of featureCols){
      if (colTypes[c] !== 'numeric') continue;
      const vec = data.map(r => {
        const v = parseFloat(r[c]);
        return Number.isFinite(v) ? v : 0;
      });
      const len = vec.length || 1;

      // 單趟算 min/max/sum，避免重複走訪
      let mn = Infinity, mx = -Infinity, sum = 0;
      for (let i = 0; i < len; i++){
        const v = vec[i];
        if (v < mn) mn = v;
        if (v > mx) mx = v;
        sum += v;
      }
      const range = (mx - mn) || 1;
      const mean = sum / len;

      // 第二趟算變異（與原邏輯一致，母體方差）
      let ssd = 0;
      for (let i = 0; i < len; i++){
        const d = vec[i] - mean;
        ssd += d * d;
      }
      const std = Math.sqrt(ssd / len) || 1;

      numStats[c] = { min: mn, max: mx, range, mean, std };
    }

    // ===== 類別特徵映射 =====
    for (const c of featureCols){
      if (colTypes[c] !== 'category') continue;
      const cats = unique(data.map(r => r[c] ?? ''));
      const map = {};
      cats.forEach((v, i) => { map[v] = i; });
      catMaps[c] = map;
      catDims[c] = cats.length; // 預先記錄維度，避免轉換時重複計算
    }

    return { featureCols, colTypes, catMaps, catDims, numStats, normalize };
  };

  /** 將原始資料轉成模型輸入矩陣 */
  AML.transformFeatures = function(data, metaPrep){
    const { featureCols, colTypes, catMaps, catDims, numStats, normalize } = metaPrep;
    const out = new Array(data.length);

    for (let rIdx = 0; rIdx < data.length; rIdx++){
      const r = data[rIdx];
      const row = [];

      for (const c of featureCols){
        if (colTypes[c] === 'numeric'){
          let v = parseFloat(r[c]);
          if (!Number.isFinite(v)) v = 0;
          const ns = numStats[c];
          v = normalize ? ((v - ns.min) / ns.range) : ((v - ns.mean) / ns.std);
          row.push(v);
        } else {
          const map = catMaps[c];
          const dim = catDims?.[c] ?? Object.keys(map).length; // 後備，理論上用不到
          const vec = new Array(dim).fill(0);
          const idx = map[r[c]];
          if (idx !== undefined && idx < dim) vec[idx] = 1;
          row.push(...vec); // 比 concat 更省記憶體
        }
      }
      out[rIdx] = row;
    }
    return out;
  };

  AML.inferTaskFromY = function(yRaw){
    const numy = yRaw.filter(isNumeric).length, uniq = unique(yRaw);
    if (numy < yRaw.length || uniq.length <= Math.min(20, yRaw.length/5)) return 'classification';
    return 'regression';
  };

  AML.buildLabelMapping = function(yRaw){
    const isAllNum = yRaw.every(isNumeric); const uniq = unique(yRaw);
    if (!isAllNum || uniq.length <= Math.min(20, yRaw.length/5)){
      const map = {}; uniq.forEach((v,i)=> map[v]=i);
      return { task:'classification', map, classes: uniq };
    }
    return { task:'regression' };
  };

  AML.prepareXY = function(data, target, normalize){
    const yRaw = data.map(r => r[target]);
    const rows = [...document.querySelectorAll('#varTable tbody tr')];
    const featureCols = [], colTypes = {};

    rows.forEach(row => {
      const colName = row.cells[0].textContent;
      const typeSel = row.cells[1].querySelector('select').value;
      const useFeat = row.cells[2].querySelector('input').checked;
      if (colName !== target && useFeat){
        featureCols.push(colName);
        if (typeSel === 'auto'){
          const sample = data.slice(0, 200).map(r => r[colName]);
          const numCount = sample.filter(isNumeric).length;
          colTypes[colName] = (numCount === sample.length) ? 'numeric' : 'category';
        } else {
          colTypes[colName] = typeSel;
        }
      }
    });

    const prep = AML.buildPreprocessorCustom(data, target, featureCols, colTypes, normalize);
    const X = AML.transformFeatures(data, prep);

    let y, task = document.getElementById('taskSelect').value;
    if (task === 'auto') task = AML.inferTaskFromY(yRaw);

    if (task === 'classification'){
      const labelInfo = AML.buildLabelMapping(yRaw);
      y = yRaw.map(v => labelInfo.map[v]);
      prep.labelInfo = labelInfo; // 與原流程一致
    } else {
      y = yRaw.map(v => parseFloat(v));
      const normTarget = !!document.getElementById('normalizeTarget')?.checked;
      prep.normalizeTarget = false;
      delete prep.yMean; delete prep.yStd;

      if (normTarget){
        const yTensor = tf.tensor1d(y);
        const { mean, variance } = tf.moments(yTensor);
        const yMean = mean.arraySync();
        const yStd = Math.sqrt(variance.arraySync()) || 1;
        if (Number.isFinite(yStd) && yStd > 0){
          y = y.map(v => (v - yMean) / yStd);
          prep.normalizeTarget = true;
          prep.yMean = yMean; prep.yStd = yStd;
        }
        yTensor.dispose(); mean.dispose(); variance.dispose();
      }
    }

    return { X, y, meta: { ...prep, targetCol: target, task } };
  };
})();
