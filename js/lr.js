// 50_lr.js
(function(){
  const AML = window.AML;
  AML.getLRSchedulerCallback = function(model, baseLR=1e-3, scheduleType='constant', totalEpochs=50, options={}){
    const stepSize = options.stepSize ?? 10;
    const gamma = options.gamma ?? 0.5;
    const expK = options.expK ?? 0.05;
    let currentLR = baseLR;
    function lrOf(epoch){
      switch(scheduleType){
        case 'step_decay': return baseLR * Math.pow(gamma, Math.floor(epoch/stepSize));
        case 'exp_decay' : return baseLR * Math.exp(-expK*epoch);
        case 'cosine_decay': return baseLR * 0.5 * (1 + Math.cos(Math.PI * epoch / Math.max(1, totalEpochs)));
        default: return baseLR;
      }
    }
    return {
      onEpochBegin: async (epoch)=>{
        currentLR = lrOf(epoch);
        if (model?.optimizer){
          if (typeof model.optimizer.learningRate === 'number') model.optimizer.learningRate = currentLR;
          else if (model.optimizer.learningRate?.assign) model.optimizer.learningRate.assign(currentLR);
          else if (model.optimizer.setLearningRate) model.optimizer.setLearningRate(currentLR);
        }
      },
      getCurrentLR: ()=> currentLR
    };
  };
  AML.getOptimizer = function(baseLR=1e-3){ return tf.train.adam(baseLR); };
})();
