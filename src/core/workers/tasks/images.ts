import type { TaskContext } from '../types';

export interface ImagePack {
  names: string[];
  data: Uint8Array[];
}

/** Class label from a folder path: root/<class>/file.jpg → class; loose files → unlabeled. */
export function labelFromPath(path: string): string | null {
  const parts = path.split(/[\\/]/).filter(Boolean);
  return parts.length >= 3 ? parts[parts.length - 2] : null;
}

/** Decode, downscale (longest side ≤ maxSide) and re-encode as JPEG inside the worker. */
export async function importImagesTask(input: { files: { path: string; bytes: ArrayBuffer }[]; maxSide: number }, ctx: TaskContext) {
  const names: string[] = [], labels: (string | null)[] = [], data: Uint8Array[] = [], failed: string[] = [];
  for (const [i, f] of input.files.entries()) {
    try {
      const bmp = await createImageBitmap(new Blob([f.bytes]));
      const scale = Math.min(1, input.maxSide / Math.max(bmp.width, bmp.height));
      const w = Math.max(1, Math.round(bmp.width * scale)), h = Math.max(1, Math.round(bmp.height * scale));
      const canvas = new OffscreenCanvas(w, h);
      canvas.getContext('2d')!.drawImage(bmp, 0, 0, w, h);
      bmp.close();
      const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.9 });
      data.push(new Uint8Array(await blob.arrayBuffer()));
      names.push(f.path.split(/[\\/]/).pop() ?? f.path);
      labels.push(labelFromPath(f.path));
    } catch {
      failed.push(f.path);
    }
    if (i % 20 === 0) { ctx.progress({ fraction: i / input.files.length }); await ctx.checkpoint(); }
  }
  return { names, labels, data, failed };
}

/** Decode JPEG/PNG bytes to a size×size RGB Float32 array scaled to [-1, 1] (MobileNet convention). */
export async function decodeImage(bytes: Uint8Array, size: number): Promise<Float32Array> {
  const bmp = await createImageBitmap(new Blob([bytes as BlobPart]));
  const canvas = new OffscreenCanvas(size, size);
  const g = canvas.getContext('2d')!;
  // centre-crop to square, then resize
  const s = Math.min(bmp.width, bmp.height);
  g.drawImage(bmp, (bmp.width - s) / 2, (bmp.height - s) / 2, s, s, 0, 0, size, size);
  bmp.close();
  const px = g.getImageData(0, 0, size, size).data;
  const out = new Float32Array(size * size * 3);
  for (let i = 0, j = 0; i < px.length; i += 4, j += 3) {
    out[j] = px[i] / 127.5 - 1;
    out[j + 1] = px[i + 1] / 127.5 - 1;
    out[j + 2] = px[i + 2] / 127.5 - 1;
  }
  return out;
}
