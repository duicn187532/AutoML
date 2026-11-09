import * as tf from '@tensorflow/tfjs';
import { describe, expect, it } from 'vitest';
import { compileGraph } from '../src/core/dag/compile';
import { analysisOk, analyze, template, type TemplateId } from '../src/core/dag/graph';
import { TEMPLATE_INFO } from '../src/modules/dag/templateInfo';

const ids = Object.keys(TEMPLATE_INFO) as TemplateId[];

describe('network designer templates', () => {
  it.each(ids)('%s analyses cleanly and builds a TF.js model', (id) => {
    const g = template(id, ['y', 'a'], ['f1', 'f2']);
    const targetDims = { y: 3, a: 1 };
    const a = analyze(g, { inputDim: 8, targetDims, features: ['f1', 'f2'] });
    expect(analysisOk(a), JSON.stringify([a.errors, Object.entries(a.info).filter(([, i]) => i.errors.length)])).toBe(true);
    if (a.mode === 'two-stage') return; // heterogeneous experts are trained outside TF.js
    const heads = Object.fromEntries(g.nodes.filter((n) => n.type === 'head').map((n) => {
      const t = String(n.params.target);
      return [n.id, { target: t, task: t === 'y' ? 'multiclass' as const : 'regression' as const, dim: targetDims[t as 'y'], weight: 1 }];
    }));
    const rules = Object.fromEntries(g.nodes.filter((n) => n.type === 'gate' && n.params.mode === 'rule').map((n) => [n.id, { index: 0, z: 0 }]));
    const c = compileGraph(tf, g, { inputDim: 8, heads, rules, seed: 1 } as never);
    const out = c.model.predict(tf.zeros([2, 8])) as tf.Tensor | tf.Tensor[];
    const first = Array.isArray(out) ? out[0] : out;
    expect(first.shape[0]).toBe(2);
    c.model.dispose();
  });
  it('every published template cites a source', () => {
    for (const id of ids) if (TEMPLATE_INFO[id].group !== 'workbench') expect(TEMPLATE_INFO[id].refs.length, id).toBeGreaterThan(0);
  });
});
