// 20_metrics.js
(function(){
  const AML = window.AML;
  AML.calcClassificationMetrics = function(yTrue, yPred, labels){
    const results = {};
    labels.forEach(label => {
      const tp = yTrue.filter((y, i) => y === label && yPred[i] === label).length;
      const fp = yTrue.filter((y, i) => y !== label && yPred[i] === label).length;
      const fn = yTrue.filter((y, i) => y === label && yPred[i] !== label).length;
      const precision = tp / (tp + fp || 1);
      const recall = tp / (tp + fn || 1);
      const f1 = 2 * (precision * recall) / ((precision + recall) || 1);
      results[label] = { precision, recall, f1 };
    });
    const accuracy = yTrue.filter((y, i) => y === yPred[i]).length / yTrue.length;
    return { accuracy, perClass: results };
  };
  AML.calcROC = function(yTrue, yScores){
    const thresholds = [...new Set(yScores)].sort((a,b)=>b-a);
    const tpr=[], fpr=[];
    thresholds.forEach(th => {
      const tp = yTrue.filter((y,i)=> y===1 && yScores[i]>=th).length;
      const fp = yTrue.filter((y,i)=> y===0 && yScores[i]>=th).length;
      const fn = yTrue.filter((y,i)=> y===1 && yScores[i]< th).length;
      const tn = yTrue.filter((y,i)=> y===0 && yScores[i]< th).length;
      tpr.push(tp / (tp + fn || 1));
      fpr.push(fp / (fp + tn || 1));
    });
    const auc = tpr.reduce((sum,t,i)=> sum + (i>0? (t + tpr[i-1])*(fpr[i]-fpr[i-1])/2 : 0), 0);
    return { fpr, tpr, auc };
  };
})();
