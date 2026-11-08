import type { ParamSpec, ParamValues } from '@/core/models/types';
import { useT } from '@/i18n';

/** Form generated from a plugin's parameter schema (labels, help, recommended range). */
export function ParamForm({ specs, values, onChange }: { specs: ParamSpec[]; values: ParamValues; onChange: (v: ParamValues) => void }) {
  const t = useT();
  const set = (k: string, v: number | string | boolean) => onChange({ ...values, [k]: v });
  return (
    <div className="param-form">
      {specs.map((s) => {
        const id = `param-${s.key}`;
        const help = s.help ? t.text(s.help) : undefined;
        return (
          <div className="field" key={s.key}>
            <label htmlFor={id} title={help}>
              {t.text(s.label)}
            </label>
            {s.type === 'bool' ? (
              <input id={id} type="checkbox" checked={values[s.key] === true} onChange={(e) => set(s.key, e.currentTarget.checked)} />
            ) : s.type === 'enum' ? (
              <select id={id} value={String(values[s.key])} onChange={(e) => set(s.key, e.currentTarget.value)}>
                {s.options.map((o) => (
                  <option key={o.value} value={o.value}>
                    {t.text(o.label)}
                  </option>
                ))}
              </select>
            ) : (
              <input
                id={id}
                type="number"
                min={s.min}
                max={s.max}
                step={s.step ?? (s.type === 'int' ? 1 : 'any')}
                value={String(values[s.key])}
                onChange={(e) => set(s.key, e.currentTarget.value === '' ? s.default : Number(e.currentTarget.value))}
              />
            )}
            {(help || (s.type !== 'bool' && s.type !== 'enum' && s.recommended)) && (
              <div className="hint">
                {s.type !== 'bool' && s.type !== 'enum' && s.recommended && <span>{t('lib.recommended', { range: `${s.recommended[0]} – ${s.recommended[1]}` })}</span>}
                {help && <span>{help}</span>}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
