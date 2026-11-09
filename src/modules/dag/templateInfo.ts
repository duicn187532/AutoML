import type { TemplateId } from '@/core/dag/graph';
import type { I18nText } from '@/i18n';

export interface TemplateRef { cite: string; url: string }
export interface TemplateInfo {
  group: 'classic' | 'moe' | 'multitask' | 'workbench';
  refs: TemplateRef[];
  /** What the template keeps from the original and what is adapted for tabular data. */
  note: I18nText;
}

/** Well-known architectures with their sources. Templates are tabular adaptations of the core idea, not reproductions. */
export const TEMPLATE_INFO: Record<TemplateId, TemplateInfo> = {
  mlp: {
    group: 'classic',
    refs: [
      { cite: 'Rumelhart, D. E., Hinton, G. E. & Williams, R. J. (1986). Learning representations by back-propagating errors. Nature, 323, 533–536.', url: 'https://doi.org/10.1038/323533a0' },
      { cite: 'Srivastava, N. et al. (2014). Dropout: A simple way to prevent neural networks from overfitting. JMLR, 15, 1929–1958.', url: 'https://jmlr.org/papers/v15/srivastava14a.html' },
    ],
    note: { 'zh-TW': '多層感知器 + Dropout 正則化。', en: 'Multilayer perceptron with dropout regularisation.' },
  },
  resnetTab: {
    group: 'classic',
    refs: [
      { cite: 'Gorishniy, Y., Rubachev, I., Khrulkov, V. & Babenko, A. (2021). Revisiting deep learning models for tabular data. NeurIPS 2021.', url: 'https://arxiv.org/abs/2106.11959' },
      { cite: 'He, K., Zhang, X., Ren, S. & Sun, J. (2016). Deep residual learning for image recognition. CVPR 2016.', url: 'https://arxiv.org/abs/1512.03385' },
    ],
    note: { 'zh-TW': '表格版 ResNet：線性 stem → 3 個殘差區塊 → BN → ReLU → 輸出。區塊內為 Dense → BN → ReLU → Dropout（順序與論文的 pre-norm 略有不同）。', en: 'Tabular ResNet: linear stem → 3 residual blocks → BN → ReLU → head. Blocks are Dense → BN → ReLU → Dropout (post-norm, slightly different from the paper).' },
  },
  residual: {
    group: 'classic',
    refs: [{ cite: 'He, K., Zhang, X., Ren, S. & Sun, J. (2016). Deep residual learning for image recognition. CVPR 2016.', url: 'https://arxiv.org/abs/1512.03385' }],
    note: { 'zh-TW': '殘差連接 + 兩條分支相加的示範圖。', en: 'Residual connections plus two branches merged by addition.' },
  },
  denseNet: {
    group: 'classic',
    refs: [{ cite: 'Huang, G., Liu, Z., van der Maaten, L. & Weinberger, K. Q. (2017). Densely connected convolutional networks. CVPR 2017.', url: 'https://arxiv.org/abs/1608.06993' }],
    note: { 'zh-TW': '密集連接：每一層都接收前面所有層輸出的串接；以 Dense 層取代卷積。', en: 'Dense connectivity: each layer receives the concatenation of all earlier outputs; Dense layers instead of convolutions.' },
  },
  inception: {
    group: 'classic',
    refs: [{ cite: 'Szegedy, C. et al. (2015). Going deeper with convolutions. CVPR 2015.', url: 'https://arxiv.org/abs/1409.4842' }],
    note: { 'zh-TW': 'Inception 的「多尺度平行分支再串接」概念；分支以不同深度的 Dense 堆疊取代 1×1/3×3/5×5 卷積。', en: 'The Inception idea of parallel multi-scale branches concatenated; branches are Dense stacks of different depth instead of 1×1/3×3/5×5 convolutions.' },
  },
  snn: {
    group: 'classic',
    refs: [{ cite: 'Klambauer, G., Unterthiner, T., Mayr, A. & Hochreiter, S. (2017). Self-normalizing neural networks. NeurIPS 2017.', url: 'https://arxiv.org/abs/1706.02515' }],
    note: { 'zh-TW': 'SELU 自正規化網路。論文另用 LeCun normal 初始化與 AlphaDropout，此處以 Glorot 初始化與一般 Dropout 近似。', en: 'SELU self-normalising network. The paper also uses LeCun-normal init and AlphaDropout; approximated here with Glorot init and plain dropout.' },
  },
  wideDeep: {
    group: 'classic',
    refs: [{ cite: 'Cheng, H.-T. et al. (2016). Wide & deep learning for recommender systems. DLRS @ RecSys 2016.', url: 'https://arxiv.org/abs/1606.07792' }],
    note: { 'zh-TW': 'Wide（線性、記憶）+ Deep（MLP、泛化）兩條路徑串接後輸出；論文的 wide 端另有人工交叉特徵。', en: 'Wide (linear, memorisation) and deep (MLP, generalisation) paths concatenated; the paper also feeds hand-crafted cross features to the wide part.' },
  },
  moe: {
    group: 'moe',
    refs: [{ cite: 'Jacobs, R. A., Jordan, M. I., Nowlan, S. J. & Hinton, G. E. (1991). Adaptive mixtures of local experts. Neural Computation, 3(1), 79–87.', url: 'https://doi.org/10.1162/neco.1991.3.1.79' }],
    note: { 'zh-TW': '門控網路以 softmax 權重混合多個 expert 的輸出。', en: 'A gating network mixes expert outputs with softmax weights.' },
  },
  moeTopK: {
    group: 'moe',
    refs: [{ cite: 'Shazeer, N. et al. (2017). Outrageously large neural networks: The sparsely-gated mixture-of-experts layer. ICLR 2017.', url: 'https://arxiv.org/abs/1701.06538' }],
    note: { 'zh-TW': '稀疏門控：每筆資料只啟用 top-k 個 expert，並加上負載平衡損失。論文的 noisy gating 未實作。', en: 'Sparse gating: only the top-k experts are active per row, with a load-balancing loss. Noisy gating from the paper is not implemented.' },
  },
  switch: {
    group: 'moe',
    refs: [{ cite: 'Fedus, W., Zoph, B. & Shazeer, N. (2022). Switch Transformers: Scaling to trillion parameter models with simple and efficient sparsity. JMLR, 23(120), 1–39.', url: 'https://arxiv.org/abs/2101.03961' }],
    note: { 'zh-TW': '只取 Switch 的路由方式：top-1 路由到 8 個 expert + 負載平衡損失（係數 0.01）；不含 Transformer 本體與 capacity factor。', en: 'Only the Switch routing: top-1 over 8 experts with a load-balancing loss (0.01); no Transformer body or capacity factor.' },
  },
  heteroMoe: {
    group: 'moe',
    refs: [
      { cite: 'Wolpert, D. H. (1992). Stacked generalization. Neural Networks, 5(2), 241–259.', url: 'https://doi.org/10.1016/S0893-6080(05)80023-1' },
      { cite: 'Jacobs, R. A. et al. (1991). Adaptive mixtures of local experts. Neural Computation, 3(1).', url: 'https://doi.org/10.1162/neco.1991.3.1.79' },
    ],
    note: { 'zh-TW': '異質 expert（XGBoost、隨機森林、NN）兩階段訓練：先以交叉驗證產生 OOF 預測（stacking），再訓練輸入相依的門控。', en: 'Heterogeneous experts trained in two stages: out-of-fold predictions (stacking), then an input-dependent gate.' },
  },
  ruleRouting: {
    group: 'workbench',
    refs: [],
    note: { 'zh-TW': '依業務規則（某欄位 ≥ 門檻）把資料分給兩個 expert；非文獻架構，為本工作台的實務範本。', en: 'Routes rows to one of two experts by a business rule (feature ≥ threshold); a practical workbench template, not a published architecture.' },
  },
  multiTask: {
    group: 'multitask',
    refs: [{ cite: 'Caruana, R. (1997). Multitask learning. Machine Learning, 28, 41–75.', url: 'https://doi.org/10.1023/A:1007379606734' }],
    note: { 'zh-TW': 'Shared-bottom：共用主幹 + 每個任務一個 tower 與 head。預設把資料集最後幾欄當作多個目標，請在 head 上調整。', en: 'Shared bottom: a common trunk plus one tower and head per task. The last columns of the dataset are used as targets; adjust them on the heads.' },
  },
  mmoe: {
    group: 'multitask',
    refs: [{ cite: 'Ma, J., Zhao, Z., Yi, X., Chen, J., Hong, L. & Chi, E. H. (2018). Modeling task relationships in multi-task learning with multi-gate mixture-of-experts. KDD 2018.', url: 'https://doi.org/10.1145/3219819.3220007' }],
    note: { 'zh-TW': 'MMoE：所有任務共用一組 expert，每個任務有自己的門控與 tower。預設把資料集最後兩欄當作兩個任務的目標。', en: 'MMoE: experts shared by all tasks, one gate and tower per task. The last two columns of the dataset are used as the two targets.' },
  },
};

export const TEMPLATE_GROUPS = ['classic', 'moe', 'multitask', 'workbench'] as const;
