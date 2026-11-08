export function amlHash(str: string): number;
export function amlTransform(prep: unknown, row: Record<string, unknown>): number[];
export function amlEvalModel(m: unknown, x: number[], nClasses: number): number[] | number;
export function amlPredict(bundle: unknown, row: Record<string, unknown>): { label?: string; proba?: number[]; value?: number };
