// Download pretrained TF.js image backbones into vendor/models/ (git-ignored); packed as engine packs.
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { IMAGE_BACKBONES } from '../build/image-backbones.mjs';

for (const b of IMAGE_BACKBONES) {
  const dir = join('vendor', 'models', b.id);
  mkdirSync(dir, { recursive: true });
  const base = b.url.slice(0, b.url.lastIndexOf('/') + 1);
  const res = await fetch(b.url);
  if (!res.ok) throw new Error(`${res.status} ${b.url}`);
  const model = await res.json();
  writeFileSync(join(dir, 'model.json'), JSON.stringify(model));
  for (const group of model.weightsManifest) for (const p of group.paths) {
    if (existsSync(join(dir, p))) continue;
    const r = await fetch(base + p);
    if (!r.ok) throw new Error(`${r.status} ${base + p}`);
    writeFileSync(join(dir, p), Buffer.from(await r.arrayBuffer()));
  }
  console.log(`${b.id}: ok`);
}
