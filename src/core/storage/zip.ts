import { strFromU8, strToU8, unzipSync, zipSync, type Zippable } from 'fflate';
import { PROJECT_FORMAT_VERSION, type Project } from '../project/types';

/**
 * Project archive (.zip) — the official save format.
 *   aml-project.json      { format, formatVersion, exportedAt, project }
 *   blobs/<key>.bin       datasets (AMLT) and models (AMLB)
 *   README.txt            human-readable description
 */
export const ZIP_FORMAT = 'aml-workbench-project';

export function exportProjectZip(project: Project, blobs: Map<string, Uint8Array>): Uint8Array {
  const files: Zippable = {
    'aml-project.json': strToU8(JSON.stringify({ format: ZIP_FORMAT, formatVersion: PROJECT_FORMAT_VERSION, exportedAt: new Date().toISOString(), project }, null, 2)),
    'README.txt': strToU8(
      `AutoML Workbench project "${project.name}"\n` +
        `Open the workbench (index.html) → 匯入專案 .zip / Import project .zip.\n` +
        `datasets: ${project.datasets.length}, models: ${project.models.length}, experiments: ${project.experiments.length}\n`,
    ),
  };
  for (const [key, bytes] of blobs) {
    if (!/^[a-z]+\/[A-Za-z0-9_-]+$/.test(key)) throw new Error(`Invalid blob key ${key}`);
    files[`blobs/${key}.bin`] = [bytes, { level: 6 }];
  }
  return zipSync(files, { level: 6 });
}

export function importProjectZip(bytes: Uint8Array): { project: Project; blobs: Map<string, Uint8Array> } {
  const files = unzipSync(bytes);
  const manifest = files['aml-project.json'];
  if (!manifest) throw new Error('Not a project archive (aml-project.json missing)');
  const parsed = JSON.parse(strFromU8(manifest)) as { format?: string; formatVersion?: number; project?: Project };
  if (parsed.format !== ZIP_FORMAT || !parsed.project) throw new Error('Unrecognised project archive');
  if ((parsed.formatVersion ?? 0) > PROJECT_FORMAT_VERSION) throw new Error(`Project was saved by a newer version (format ${parsed.formatVersion})`);
  const blobs = new Map<string, Uint8Array>();
  for (const [path, data] of Object.entries(files)) {
    const m = /^blobs\/([a-z]+\/[A-Za-z0-9_-]+)\.bin$/.exec(path);
    if (m) blobs.set(m[1], data);
  }
  const project = parsed.project;
  for (const d of project.datasets) if (!blobs.has(d.blobKey)) throw new Error(`Archive is missing data for dataset "${d.name}"`);
  return { project, blobs };
}
