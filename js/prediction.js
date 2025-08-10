// 80_prediction.js
(function(){
  const AML = window.AML;

  AML.attachPredictionHandlers = function(){
    const predictBtn = document.getElementById('predictBtn');
    predictBtn?.addEventListener('click', ()=>{
      const pf = document.getElementById('predictCsv').files?.[0];
      if (!AML.state.meta){ alert('請先訓練或載入模型與 metadata'); return; }
      if (!pf){ alert('請上傳要預測的 CSV'); return; }

      const status = document.getElementById('predictStatus'); status.textContent = '資料處理中…';
      Papa.parse(pf, {
        header:true, skipEmptyLines:true, complete: (res)=>{
          try{
            const rows = res.data;
            const Xnew = AML.transformFeatures(rows, AML.state.meta);
            if (AML.state.traditionalModel){
              let pred = AML.state.traditionalModel.predict(Xnew);
              if (AML.state.meta.task === 'regression' && AML.state.meta.normalizeTarget &&
                  Number.isFinite(AML.state.meta.yMean) && Number.isFinite(AML.state.meta.yStd)){
                pred = pred.map(v => (v * AML.state.meta.yStd) + AML.state.meta.yMean);
              }
              if (AML.state.meta.task === 'classification' && AML.state.meta.labelInfo){
                AML.state.lastPredRows = rows.map((r,i)=> ({ ...r, 預測值: AML.state.meta.labelInfo.classes[pred[i]] ?? pred[i] }));
              } else {
                AML.state.lastPredRows = rows.map((r,i)=> ({ ...r, 預測值: pred[i] }));
              }
              AML.renderTable('predictTable', AML.state.lastPredRows.slice(0,100));
              status.textContent = '✅ 完成（傳統 ML）';
              document.getElementById('downloadPredBtn').disabled = false;
              return;
            }
            if (!AML.state.tfModel){ alert('請先以 TF.js 訓練或在設定頁載入 TF.js 模型'); return; }
            const x = tf.tensor2d(Xnew, undefined, 'float32');
            const p = AML.state.tfModel.predict(x);
            if (AML.state.meta.task === 'classification'){
              const probs = p.arraySync();
              const cls = AML.state.meta.labelInfo?.classes || [];
              const idx = probs.map(v => {
                if (Array.isArray(v)){
                  if (v.length > 1){ let mi=0, mv=v[0]; for (let i=1;i<v.length;i++) if (v[i]>mv){ mv=v[i]; mi=i; } return mi; }
                  else return v[0]>0.5?1:0;
                }
                return v>0.5?1:0;
              });
              AML.state.lastPredRows = rows.map((r,i)=> ({ ...r, 預測值: (cls[idx[i]] !== undefined ? cls[idx[i]] : idx[i]) }));
            } else {
              let vals = p.arraySync().map(v => Array.isArray(v) ? v[0] : v);
              if (AML.state.meta.task === 'regression' && AML.state.meta.normalizeTarget &&
                  Number.isFinite(AML.state.meta.yMean) && Number.isFinite(AML.state.meta.yStd)){
                vals = vals.map(v => (v * AML.state.meta.yStd) + AML.state.meta.yMean);
              }
              AML.state.lastPredRows = rows.map((r,i)=> ({ ...r, 預測值: vals[i] }));
            }
            x.dispose(); p.dispose();
            AML.renderTable('predictTable', AML.state.lastPredRows.slice(0,100));
            status.textContent = '✅ 完成（TF.js）';
            document.getElementById('downloadPredBtn').disabled = false;
          }catch(e){
            console.error(e);
            status.textContent = '❌ 預測失敗：' + e.message;
          }
        }
      });
    });

    document.getElementById('downloadPredBtn')?.addEventListener('click', ()=>{
      if (!AML.state.lastPredRows.length) return;
      AML.downloadBlob('predictions.csv', AML.toCSV(AML.state.lastPredRows), 'text/csv');
    });
  };
})();
