// 00_namespace.js
(function(){
  window.AML = window.AML || {};
  const AML = window.AML;

  AML.state = {
    rawData: [],
    columns: [],
    meta: null,
    tfModel: null,
    traditionalModel: null,
    lastPredRows: [],
    chartInstances: {},
    chartsInit: false,
    charts: { loss: null, acc: null, lr: null },
    customLayers: [],

    // 完全用狀態控制（不再有 CUSTOM_ALLOWED、也不再依賴 #modelSelect/#customModelToggle）
    mode: 'auto',           // 'auto' | 'preset' | 'custom'
    selectedModel: 'mlp',   // 在 preset/custom 模式下使用
    customEnabled: false    // custom 模式時為 true
  };

  // 保留傳統 ML 與 Auto 候選清單
  AML.ML_MODEL_MAP = {
    tree: { cls: 'DecisionTreeClassifier', reg: 'DecisionTreeRegression' },
    rf:   { cls: 'RandomForestClassifier', reg: 'RandomForestRegression' },
    knn:  { cls: 'KNN', reg: 'KNN' },
    svm:  { cls: 'SVM', reg: 'SVM' },
    nb:   { cls: 'NaiveBayes', reg: null }, // NB 無回歸
  };

  AML.AUTO_MODEL_CANDIDATES = {
    classification: ['mlp', 'mlp_bn', 'deepmlp', 'deepmlp_bn', 'logistic',],
    regression:     ['linear', 'poly', 'mlp', 'mlp_bn', 'deepmlp', 'deepmlp_bn',],
  };
  
})();
