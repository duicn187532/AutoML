import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Project } from '../project/types';

/**
 * IndexedDB layout (primary working storage; .zip export is the durable save format,
 * because browsers may evict storage for file:// pages).
 *   projects: Project JSON by id
 *   blobs:    { projectId, key, bytes } keyed by [projectId, key]
 *   meta:     small key/value (last opened project …)
 */
interface AmlDB extends DBSchema {
  projects: { key: string; value: Project };
  blobs: { key: [string, string]; value: { projectId: string; key: string; bytes: Uint8Array }; indexes: { byProject: string } };
  meta: { key: string; value: unknown };
}

const DB_NAME = 'aml-workbench';
const DB_VERSION = 1;

export class ProjectStorage {
  private dbp: Promise<IDBPDatabase<AmlDB>>;

  constructor(name = DB_NAME) {
    this.dbp = openDB<AmlDB>(name, DB_VERSION, {
      upgrade(db) {
        db.createObjectStore('projects', { keyPath: 'id' });
        const blobs = db.createObjectStore('blobs', { keyPath: ['projectId', 'key'] });
        blobs.createIndex('byProject', 'projectId');
        db.createObjectStore('meta');
      },
    });
  }

  async listProjects(): Promise<Pick<Project, 'id' | 'name' | 'updatedAt'>[]> {
    const all = await (await this.dbp).getAll('projects');
    return all.map(({ id, name, updatedAt }) => ({ id, name, updatedAt })).sort((a, b) => b.updatedAt - a.updatedAt);
  }

  async getProject(id: string): Promise<Project | undefined> {
    return (await this.dbp).get('projects', id);
  }

  async putProject(p: Project): Promise<void> {
    await (await this.dbp).put('projects', p);
  }

  async deleteProject(id: string): Promise<void> {
    const db = await this.dbp;
    const tx = db.transaction(['projects', 'blobs'], 'readwrite');
    await tx.objectStore('projects').delete(id);
    const idx = tx.objectStore('blobs').index('byProject');
    for (let cur = await idx.openCursor(id); cur; cur = await cur.continue()) await cur.delete();
    await tx.done;
  }

  async putBlob(projectId: string, key: string, bytes: Uint8Array): Promise<void> {
    await (await this.dbp).put('blobs', { projectId, key, bytes });
  }

  async getBlob(projectId: string, key: string): Promise<Uint8Array | undefined> {
    return (await (await this.dbp).get('blobs', [projectId, key]))?.bytes;
  }

  async deleteBlob(projectId: string, key: string): Promise<void> {
    await (await this.dbp).delete('blobs', [projectId, key]);
  }

  async listBlobKeys(projectId: string): Promise<string[]> {
    const rows = await (await this.dbp).getAllFromIndex('blobs', 'byProject', projectId);
    return rows.map((r) => r.key);
  }

  async getMeta<T>(key: string): Promise<T | undefined> {
    return (await (await this.dbp).get('meta', key)) as T | undefined;
  }

  async setMeta(key: string, value: unknown): Promise<void> {
    await (await this.dbp).put('meta', value, key);
  }

  async close(): Promise<void> {
    (await this.dbp).close();
  }
}
