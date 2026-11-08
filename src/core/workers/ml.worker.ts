import { expose } from 'comlink';
import { createWorkerApi } from './runtime';

expose(createWorkerApi(self));
