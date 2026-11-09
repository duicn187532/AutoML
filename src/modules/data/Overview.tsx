import { fmtNum } from '@/app/format';
import type { DataProfile, QualityIssue } from '@/core/data/explore';
import type { ColumnKind, ColumnProfile } from '@/core/data/table';
import type { DatasetRecord } from '@/core/project/types';
import { useT, type MessageKey } from '@/i18n';
import { BRAND } from '@/app/brand';

const KINDS: ColumnKind[] = ['numeric', 'categorical', 'text', 'datetime', 'id'];

function summary(c: ColumnProfile): string {
  if (c.kind === 'numeric') return `${fmtNum(c.min)} … ${fmtNum(c.max)} · μ ${fmtNum(c.mean)} · σ ${fmtNum(c.std)}`;
  return (c.top ?? []).slice(0, 4).map((x) => `${x.value} (${x.count})`).join(', ');
}

export function issueText(t: ReturnType<typeof useT>, q: QualityIssue): string {
  const v = q.value ?? 0;
  const vars = { col: q.column ?? '', pct: (v * 100).toFixed(1), n: Math.round(v).toLocaleString(), score: v.toFixed(3) };
  return t(`quality.${q.check}` as MessageKey, vars);
}

export function QualityReport({ profile }: { profile: DataProfile }) {
  const t = useT();
  const counts = { warn: 0, auto: 0, pass: 0 };
  for (const q of profile.quality) counts[q.status]++;
  return (
    <div className="card" data-testid="quality-report">
      <div className="row quality-head">
        <img className="quality-orei" src={BRAND.orei} alt="" />
        <div className="quality-title">
          <h3>{t('quality.title')}</h3>
          <span className="small muted">{t('quality.byOrei')}</span>
        </div>
        <span className="badge warn-tag">{t('quality.warn')} {counts.warn}</span>
        <span className="badge ok-tag">{t('quality.auto')} {counts.auto}</span>
        {profile.quality.length === 0 && <span className="badge ok-tag">{t('quality.pass')}</span>}
      </div>
      <ul className="issues">
        {profile.quality.map((q, i) => (
          <li key={i} className={`issue ${q.status}`}>
            <span className={`badge ${q.status === 'warn' ? 'warn-tag' : 'ok-tag'}`}>{t(`quality.${q.status}` as MessageKey)}</span>
            <span>{issueText(t, q)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ColumnsTable({ dataset, onSetKind }: { dataset: DatasetRecord; onSetKind: (col: string, kind: ColumnKind) => void }) {
  const t = useT();
  return (
    <div className="card">
      <h3>{t('data.columns')}</h3>
      <p className="small muted">{t('data.kindHint')}</p>
      <div className="table-wrap">
        <table className="grid" data-testid="columns-table">
          <thead>
            <tr>
              <th>{t('data.col.name')}</th>
              <th>{t('data.col.kind')}</th>
              <th className="num">{t('data.col.missing')}</th>
              <th className="num">{t('data.col.unique')}</th>
              <th>{t('data.col.summary')}</th>
            </tr>
          </thead>
          <tbody>
            {dataset.columns.map((c) => (
              <tr key={c.name}>
                <td>{c.name}</td>
                <td>
                  <select className={`kind kind-${c.kind}`} value={c.kind} onChange={(e) => onSetKind(c.name, e.currentTarget.value as ColumnKind)} aria-label={t('data.col.kind')}>
                    {KINDS.map((k) => <option key={k} value={k}>{t(`kind.${k}` as MessageKey)}</option>)}
                  </select>
                </td>
                <td className="num">{c.missing ? `${c.missing} (${((c.missing / dataset.rowCount) * 100).toFixed(1)}%)` : 0}</td>
                <td className="num">{c.unique.toLocaleString()}</td>
                <td className="small muted ellipsis">{summary(c)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
