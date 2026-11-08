import type { TaskContext, TaskKindName, TaskMap } from '../types';
import { autoTask } from './auto';
import { predictTask } from './predict';
import { pyRunTask } from './pyRun';
import { trainGraphTask } from './trainGraph';
import { benchmarkTask } from './benchmark';
import { profileTable } from '../../data/explore';
import { applyPipeline } from '../../data/ops';
import { parseCsvTask } from './parseCsv';
import { sleepTask } from './sleep';
import { trainTask } from './train';

type Handler<K extends TaskKindName> = (input: TaskMap[K][0], ctx: TaskContext) => Promise<TaskMap[K][1]>;

export const TASK_HANDLERS: { [K in TaskKindName]: Handler<K> } = {
  parseCsv: parseCsvTask,
  train: trainTask,
  sleep: sleepTask,
  benchmark: benchmarkTask,
  auto: autoTask,
  predict: predictTask,
  pyRun: pyRunTask,
  trainGraph: trainGraphTask,
  profile: async ({ table, target }) => profileTable(table, target),
  applyPipeline: async ({ table, steps }) => applyPipeline(table, steps),
};
