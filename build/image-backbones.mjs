// Pretrained image backbones (TF.js layers models, ImageNet) shipped as engine packs.
// `feature` = layer whose output is used as the embedding (before the classifier).
export const IMAGE_BACKBONES = [
  { id: 'mobilenet-025', label: 'MobileNet v1 0.25 (224)', url: 'https://storage.googleapis.com/tfjs-models/tfjs/mobilenet_v1_0.25_224/model.json', size: 224, feature: 'global_average_pooling2d_1' },
  { id: 'mobilenet-050', label: 'MobileNet v1 0.50 (224)', url: 'https://storage.googleapis.com/tfjs-models/tfjs/mobilenet_v1_0.50_224/model.json', size: 224, feature: 'global_average_pooling2d_1' },
  { id: 'mobilenet-100', label: 'MobileNet v1 1.00 (224)', url: 'https://storage.googleapis.com/tfjs-models/tfjs/mobilenet_v1_1.0_224/model.json', size: 224, feature: 'global_average_pooling2d_1' },
];
