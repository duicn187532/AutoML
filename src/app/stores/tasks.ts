import { create } from 'zustand';
import type { TaskSnapshot } from '@/core/workers/pool';
import { pool } from '../services';

interface TaskState {
  tasks: TaskSnapshot[];
  /** Live learning-curve points per task id. */
  points: Record<string, Record<string, number>[]>;
  addPoint(id: string, p: Record<string, number>): void;
  clearFinished(): void;
}

export const useTasks = create<TaskState>((set) => ({
  tasks: [],
  points: {},
  addPoint: (id, p) => set((s) => ({ points: { ...s.points, [id]: [...(s.points[id] ?? []), p] } })),
  clearFinished: () => {
    pool.clearFinished();
    set((s) => {
      const tasks = s.tasks.filter((t) => t.status === 'queued' || t.status === 'running');
      const keep = new Set(tasks.map((t) => t.id));
      return { tasks, points: Object.fromEntries(Object.entries(s.points).filter(([k]) => keep.has(k))) };
    });
  },
}));

pool.subscribe((snap) => {
  useTasks.setState((s) => {
    const i = s.tasks.findIndex((t) => t.id === snap.id);
    const tasks = i < 0 ? [snap, ...s.tasks] : s.tasks.map((t, k) => (k === i ? snap : t));
    return { tasks };
  });
});
