// 90_exports.js
(function(){
  const AML = window.AML;
  AML.attachExportHandlers = function(){
    document.getElementById('downloadModelBtn')?.addEventListener('click', async ()=>{
      if (!AML.state.tfModel){ alert('目前模型不可下載（傳統 ML 不支援或尚未訓練 TF.js 模型）'); return; }
      try{ await AML.state.tfModel.save('downloads://tfjs_model'); } catch(e){ alert('下載失敗：' + e.message); }
    });
    document.getElementById('downloadMetaBtn')?.addEventListener('click', ()=>{
      if (!AML.state.meta){ alert('尚未有可匯出的 metadata'); return; }
      AML.downloadBlob('metadata.json', JSON.stringify(AML.state.meta, null, 2), 'application/json');
    });
    document.getElementById('downloadMLModelBtn')?.addEventListener('click', ()=>{
      if (!AML.state.traditionalModel){ alert('目前沒有傳統 ML 模型可匯出'); return; }
      const pkg = {
        format: 'mlbundle-experimental-v1',
        timestamp: new Date().toISOString(),
        task: AML.state.meta?.task ?? null,
        modelType: AML.state.meta?.modelType ?? null,
        preprocessor: AML.state.meta ? {
          featureCols: AML.state.meta.featureCols,
          colTypes: AML.state.meta.colTypes,
          catMaps: AML.state.meta.catMaps,
          numStats: AML.state.meta.numStats,
          normalize: AML.state.meta.normalize,
          targetCol: AML.state.meta.targetCol,
          labelInfo: AML.state.meta.labelInfo ?? null
        } : null,
        modelState: JSON.parse(AML.safeStringify(AML.state.traditionalModel))
      };
      try{ AML.downloadBlob('ml_model.json', JSON.stringify(pkg, null, 2), 'application/json'); }
      catch(e){ console.error(e); alert('匯出失敗：' + e.message); }
    });
  };
})();
