import type { TaskContext, TaskKindName, TaskMap } from '../types';
import { autoTask } from './auto';
import { explainTask, predictTask } from './predict';
import { pyRunTask } from './pyRun';
import { trainGraphTask } from './trainGraph';
import { exportPortableTask } from './exportPortable';
import { forecastTask, unsupervisedTask } from './analysis';
import { importImagesTask } from './images';
import { predictImageTask, trainImageTask } from './trainImage';
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
  explain: explainTask,
  pyRun: pyRunTask,
  trainGraph: trainGraphTask,
  exportPortable: exportPortableTask,
  unsupervised: unsupervisedTask,
  importImages: importImagesTask,
  trainImage: trainImageTask,
  predictImage: predictImageTask,
  forecast: forecastTask,
  profile: async ({ table, target }) => profileTable(table, target),
  applyPipeline: async ({ table, steps }) => applyPipeline(table, steps),
};
