// 80_prediction.js
(function(){
  const AML = window.AML;
  AML.state.outputProbabilities = false; // 預設只輸出單一類別

  AML.attachPredictionHandlers = function(){
    const predictBtn = document.getElementById('predictBtn');
    predictBtn?.addEventListener('click', ()=>{
      const pf = document.getElementById('predictCsv').files?.[0];
      if (!AML.state.meta){ alert('請先訓練或載入模型與 metadata'); return; }
      if (!pf){ alert('請上傳要預測的 CSV'); return; }

      const status = document.getElementById('predictStatus'); 
      status.textContent = '資料處理中…';

      Papa.parse(pf, {
        header:true, skipEmptyLines:true, complete: (res)=>{
          try{
            const rows = res.data;
            const Xnew = AML.transformFeatures(rows, AML.state.meta);

            // ========== 傳統 ML 模型 ==========
            if (AML.state.traditionalModel){
              if (AML.state.meta.task === 'classification' 
                  && AML.state.outputProbabilities 
                  && AML.state.traditionalModel.predict_proba) {
                // 有 predict_proba 時輸出完整機率
                const probs = AML.state.traditionalModel.predict_proba(Xnew);
                const cls = AML.state.meta.labelInfo?.classes || [];
                AML.state.lastPredRows = rows.map((r, i) => {
                  const rowProbs = {};
                  probs[i].forEach((pv, j) => {
                    rowProbs[`機率_${cls[j] ?? j}`] = pv;
                  });
                  const maxIdx = probs[i].indexOf(Math.max(...probs[i]));
                  return { ...r, 預測值: cls[maxIdx] ?? maxIdx, ...rowProbs };
                });
              } else {
                // 一般預測
                let pred = AML.state.traditionalModel.predict(Xnew);
                if (AML.state.meta.task === 'regression' && AML.state.meta.normalizeTarget &&
                    Number.isFinite(AML.state.meta.yMean) && Number.isFinite(AML.state.meta.yStd)){
                  pred = pred.map(v => (v * AML.state.meta.yStd) + AML.state.meta.yMean);
                }
                if (AML.state.meta.task === 'classification' && AML.state.meta.labelInfo){
                  AML.state.lastPredRows = rows.map((r,i)=> ({ 
                    ...r, 預測值: AML.state.meta.labelInfo.classes[pred[i]] ?? pred[i] 
                  }));
                } else {
                  AML.state.lastPredRows = rows.map((r,i)=> ({ ...r, 預測值: pred[i] }));
                }
              }

              AML.renderTable('predictTable', AML.state.lastPredRows.slice(0,100));
              status.textContent = '✅ 完成（傳統 ML）';
              document.getElementById('downloadPredBtn').disabled = false;
              return;
            }

            // ========== TF.js 模型 ==========
            if (!AML.state.tfModel){ 
              alert('請先以 TF.js 訓練或在設定頁載入 TF.js 模型'); 
              return; 
            }

            const x = tf.tensor2d(Xnew, undefined, 'float32');
            const raw = AML.state.tfModel.predict(x);

            if (AML.state.meta.task === 'classification') {
              let probs;
              if (AML.state.meta.numClasses > 2) {
                // 多分類 softmax
                probs = raw.softmax().arraySync();
              } else {
                // 二分類 sigmoid → [1-p, p]
                const arr = raw.sigmoid().arraySync();
                probs = arr.map(v => [1 - v[0], v[0]]);
              }

              const cls = AML.state.meta.labelInfo?.classes || [];

              if (AML.state.outputProbabilities) {
                // 輸出完整機率
                AML.state.lastPredRows = rows.map((r, i) => {
                  const rowProbs = {};
                  probs[i].forEach((pv, j) => {
                    rowProbs[`機率_${cls[j] ?? j}`] = pv;
                  });
                  const maxIdx = probs[i].indexOf(Math.max(...probs[i]));
                  return { ...r, 預測值: cls[maxIdx] ?? maxIdx, ...rowProbs };
                });
              } else {
                // 只輸出最可能類別
                const idx = probs.map(v => v.indexOf(Math.max(...v)));
                AML.state.lastPredRows = rows.map((r, i) => ({
                  ...r,
                  預測值: cls[idx[i]] !== undefined ? cls[idx[i]] : idx[i]
                }));
              }
            } else {
              // 回歸
              let vals = raw.arraySync().map(v => Array.isArray(v) ? v[0] : v);
              if (AML.state.meta.task === 'regression' && AML.state.meta.normalizeTarget &&
                  Number.isFinite(AML.state.meta.yMean) && Number.isFinite(AML.state.meta.yStd)){
                vals = vals.map(v => (v * AML.state.meta.yStd) + AML.state.meta.yMean);
              }
              AML.state.lastPredRows = rows.map((r,i)=> ({ ...r, 預測值: vals[i] }));
            }

            x.dispose(); raw.dispose();
            AML.renderTable('predictTable', AML.state.lastPredRows.slice(0,100));
            status.textContent = '✅ 完成（TF.js）';
            document.getElementById('downloadPredBtn').disabled = false;

          } catch(e) {
            console.error(e);
            status.textContent = '❌ 預測失敗：' + e.message;
          }
        }
      });
    });

    // 下載結果
    document.getElementById('downloadPredBtn')?.addEventListener('click', ()=>{
      if (!AML.state.lastPredRows.length) return;
      AML.downloadBlob('predictions.csv', AML.toCSV(AML.state.lastPredRows), 'text/csv');
    });

    // 機率輸出開關（需在 HTML 放一個 checkbox，id="probToggle"）
    document.getElementById('probToggle')?.addEventListener('change', e => {
      AML.state.outputProbabilities = e.target.checked;
    });
  };
})();
