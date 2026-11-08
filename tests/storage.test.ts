import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { decodeTable, encodeTable } from '@/core/data/codec';
import { inferTable } from '@/core/data/infer';
import { datasetBlobKey, emptyProject } from '@/core/project/types';
import { decodeBinJson, encodeBinJson } from '@/core/storage/binjson';
import { ProjectStorage } from '@/core/storage/db';
import { exportProjectZip, importProjectZip } from '@/core/storage/zip';

describe('binary JSON', () => {
  it('round-trips nested typed arrays', () => {
    const v = { a: 1, w: new Float32Array([1.5, -2]), nested: { b: new Uint8Array([1, 2, 3]), i: new Int32Array([7]) }, f: new Float64Array([Math.PI]), s: 'ok' };
    const back = decodeBinJson<typeof v>(encodeBinJson(v));
    expect(back.s).toBe('ok');
    expect(back.w).toBeInstanceOf(Float32Array);
    expect(Array.from(back.w)).toEqual([1.5, -2]);
    expect(Array.from(back.nested.b)).toEqual([1, 2, 3]);
    expect(back.nested.i[0]).toBe(7);
    expect(back.f[0]).toBe(Math.PI);
  });
});

describe('IndexedDB storage', () => {
  it('stores projects and blobs; deleting a project removes its blobs', async () => {
    const st = new ProjectStorage('test-db-1');
    const p = emptyProject('p1', 'Demo', 42, 'test');
    await st.putProject(p);
    await st.putBlob('p1', 'dataset/a', new Uint8Array([1, 2]));
    await st.putBlob('p2', 'dataset/a', new Uint8Array([9]));
    expect((await st.getProject('p1'))?.name).toBe('Demo');
    expect(Array.from((await st.getBlob('p1', 'dataset/a'))!)).toEqual([1, 2]);
    expect(await st.listBlobKeys('p1')).toEqual(['dataset/a']);
    await st.setMeta('last', 'p1');
    expect(await st.getMeta('last')).toBe('p1');
    await st.deleteProject('p1');
    expect(await st.getProject('p1')).toBeUndefined();
    expect(await st.getBlob('p1', 'dataset/a')).toBeUndefined();
    expect(await st.getBlob('p2', 'dataset/a')).toBeDefined();
    await st.close();
  });
});

describe('project .zip', () => {
  const table = inferTable(['x', '名稱'], [['1', '2'], ['a', 'b']]);
  const project = emptyProject('p1', '測試專案', 7, 'test');
  project.datasets.push({ id: 'd1', name: 'ds', source: { type: 'csv' }, rowCount: 2, columns: [], blobKey: datasetBlobKey('d1'), hash: 'h', createdAt: 0 });

  it('round-trips project JSON and blobs', () => {
    const zip = exportProjectZip(project, new Map([[datasetBlobKey('d1'), encodeTable(table)]]));
    const back = importProjectZip(zip);
    expect(back.project).toEqual(project);
    expect(decodeTable(back.blobs.get('dataset/d1')!).columns[1].values).toEqual(['a', 'b']);
  });

  it('rejects foreign or incomplete archives and bad keys', () => {
    expect(() => importProjectZip(exportProjectZip(project, new Map()))).toThrow(/missing data/);
    expect(() => exportProjectZip(project, new Map([['../evil', new Uint8Array()]]))).toThrow(/Invalid blob key/);
    expect(() => importProjectZip(new Uint8Array([1, 2, 3]))).toThrow();
  });
});
