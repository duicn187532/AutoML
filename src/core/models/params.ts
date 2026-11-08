import type { TaskKind } from '../ml/preprocess';
import type { ModelPlugin, ParamSpec, ParamValues } from './types';

export function defaultParams(plugin: ModelPlugin, task?: TaskKind): ParamValues {
  const base = Object.fromEntries(plugin.params.map((p) => [p.key, p.default])) as ParamValues;
  return { ...base, ...(task ? plugin.taskDefaults?.[task] : undefined) };
}

/** Coerce + clamp user input against the schema. Unknown keys are dropped. */
export function validateParams(specs: ParamSpec[], input: ParamValues): { params: ParamValues; errors: { key: string; message: string }[] } {
  const params: ParamValues = {};
  const errors: { key: string; message: string }[] = [];
  for (const s of specs) {
    const raw = input[s.key];
    if (raw === undefined) { params[s.key] = s.default; continue; }
    if (s.type === 'bool') {
      params[s.key] = raw === true || raw === 'true';
    } else if (s.type === 'enum') {
      const v = String(raw);
      if (s.options.some((o) => o.value === v)) params[s.key] = v;
      else { errors.push({ key: s.key, message: `invalid option ${v}` }); params[s.key] = s.default; }
    } else {
      let v = typeof raw === 'number' ? raw : Number(raw);
      if (!Number.isFinite(v)) { errors.push({ key: s.key, message: 'not a number' }); v = s.default; }
      if (s.type === 'int') v = Math.round(v);
      if (v < s.min || v > s.max) { errors.push({ key: s.key, message: `out of range [${s.min}, ${s.max}]` }); v = Math.min(s.max, Math.max(s.min, v)); }
      params[s.key] = v;
    }
  }
  return { params, errors };
}

export const num = (p: ParamValues, k: string) => Number(p[k]);
export const str = (p: ParamValues, k: string) => String(p[k]);
export const bool = (p: ParamValues, k: string) => p[k] === true;
