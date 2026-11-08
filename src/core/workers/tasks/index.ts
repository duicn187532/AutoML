import type { TaskContext, TaskKindName, TaskMap } from '../types';
import { parseCsvTask } from './parseCsv';
import { sleepTask } from './sleep';
import { trainTask } from './train';

type Handler<K extends TaskKindName> = (input: TaskMap[K][0], ctx: TaskContext) => Promise<TaskMap[K][1]>;

export const TASK_HANDLERS: { [K in TaskKindName]: Handler<K> } = {
  parseCsv: parseCsvTask,
  train: trainTask,
  sleep: sleepTask,
};
