import { DecisionTreeClassifier as _DecisionTreeClassifier, DecisionTreeRegression as _DecisionTreeRegression } from 'ml-cart';
import { RandomForestClassifier as _RandomForestClassifier, RandomForestRegression as _RandomForestRegression } from 'ml-random-forest';
import KNNLib from 'ml-knn';
import SVMLib from 'ml-svm';
import { GaussianNB as _GaussianNB } from 'ml-naivebayes';

// ===== 工具函式 =====
function ensure2D(X) {
  if (!Array.isArray(X)) throw new Error('X 必須是 array');
  const arr = Array.isArray(X[0]) ? X : [X];
  return arr.map(row => row.map(v => (isFinite(v) ? Number(v) : 0)));
}

// ===== 包裝模型 =====
class DecisionTreeClassifier {
  constructor(X, y, options) {
    this.model = new _DecisionTreeClassifier(options || {});
    this.model.train(ensure2D(X), y);
  }
  predict(X) {
    return this.model.predict(ensure2D(X));
  }
}

class DecisionTreeRegression {
  constructor(X, y, options) {
    this.model = new _DecisionTreeRegression(options || {});
    this.model.train(ensure2D(X), y);
  }
  predict(X) {
    return this.model.predict(ensure2D(X));
  }
}

class RandomForestClassifier {
  constructor(X, y, options) {
    this.model = new _RandomForestClassifier(options || {});
    this.model.train(ensure2D(X), y);
  }
  predict(X) {
    return this.model.predict(ensure2D(X));
  }
}

class RandomForestRegression {
  constructor(X, y, options) {
    this.model = new _RandomForestRegression(options || {});
    this.model.train(ensure2D(X), y);
  }
  predict(X) {
    return this.model.predict(ensure2D(X));
  }
}

class NaiveBayes {
  constructor(X, y, options) {
    this.model = new _GaussianNB(options || {});
    this.model.train(ensure2D(X), y);
  }
  predict(X) {
    return this.model.predict(ensure2D(X));
  }
}

class KNN {
  constructor(X, y, options) {
    this.model = new KNNLib(ensure2D(X), y, options || {});
  }
  predict(X) {
    return this.model.predict(ensure2D(X));
  }
}

class SVM {
  constructor(X, y, options) {
    this.model = new SVMLib(options || {});
    this.model.train(ensure2D(X), y);
  }
  predict(X) {
    return this.model.predict(ensure2D(X));
  }
}

// ===== 匯出到全域（鍵名直接符合 script.js 預期）=====
window.MLBundle = {
  DecisionTreeClassifier,
  DecisionTreeRegression,
  RandomForestClassifier,
  RandomForestRegression,
  KNN,
  SVM,
  NaiveBayes
};
