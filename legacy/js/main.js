// 99_main.js
(function(){
  const AML = window.AML;
  document.addEventListener('DOMContentLoaded', ()=>{
    AML.attachTabs();
    AML.attachDataLoader();
    AML.attachModelLoaders();
    AML.setupModelUI();
    AML.ensureCharts();
    AML.attachTrainingHandlers();
    AML.attachPredictionHandlers();
    AML.attachExportHandlers();
  });
})();
