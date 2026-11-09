import type { ReactNode } from 'react';
import { useT, type MessageKey } from '@/i18n';
import { BRAND, PAW } from '../brand';
import { useUi, type ModuleId } from '../stores/ui';

/** Paw print: 'done' filled ginger, 'current' filled accent, 'todo' pale. */
export function Paw({ state = 'current', size = 26 }: { state?: 'done' | 'current' | 'todo'; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" className={`paw paw-${state}`}>
      <ellipse {...PAW.pad} />
      {PAW.toes.map((c, i) => <circle key={i} {...c} />)}
    </svg>
  );
}

/** Hand-drawn "energy lines" from the brand illustrations, redrawn as a clean SVG. */
export function EnergyLines({ size = 30 }: { size?: number }) {
  return (
    <svg viewBox="0 0 40 40" width={size} height={size} aria-hidden="true" className="energy">
      <path d="M36 30 L27 26 M31 14 L24 20 M18 4 L17 14" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

/** Page title + one-line explanation, optional mascot art on the right. */
export function PageHeader({ id, title, art, banner, children }: { id: ModuleId; title?: string; art?: string; banner?: boolean; children?: ReactNode }) {
  const t = useT();
  return (
    <header className={art ? 'page-head with-art' : 'page-head'}>
      <div className="page-head-text">
        <h1>{title ?? t(`nav.${id}` as MessageKey)}<EnergyLines /></h1>
        <p className="page-desc">{t(`page.${id}.desc` as MessageKey)}</p>
      </div>
      {children && <div className="page-head-actions">{children}</div>}
      {art && <img className={banner ? 'page-art banner' : 'page-art'} src={art} alt="" />}
    </header>
  );
}

/** A message "said" by one of the brand cats: 八萬 finds things, 歐雷 keeps things safe. */
export function MascotNote({ who, title, children, tone = 'warn', testId }: { who: 'hachiman' | 'orei'; title: ReactNode; children?: ReactNode; tone?: 'warn' | 'info'; testId?: string }) {
  return (
    <div className={`mascot-note ${tone}`} data-testid={testId}>
      <img src={who === 'hachiman' ? BRAND.alert : BRAND.orei} alt="" className={`mascot-avatar ${who}`} />
      <div className="mascot-body">
        <strong>{title}</strong>
        {children && <div>{children}</div>}
      </div>
    </div>
  );
}

/** Friendly empty state: illustration, title, short explanation and the next action. */
export function EmptyState({ image, title, body, children }: { image: string; title: string; body: string; children?: ReactNode }) {
  return (
    <div className="empty" data-testid="empty-state">
      <img className="empty-art" src={image} alt="" />
      <h2>{title}</h2>
      <p>{body}</p>
      {children && <div className="empty-actions">{children}</div>}
    </div>
  );
}

/** A page that cannot do anything without a dataset. */
export function NeedData({ id }: { id: ModuleId }) {
  const t = useT();
  return (
    <div className="module">
      <PageHeader id={id} />
      <EmptyState image={BRAND.orei} title={t('empty.needData.title')} body={t('empty.needData.body')}>
        <button className="primary big" onClick={() => useUi.getState().setModule('data')}>{t('empty.needData.go')} →</button>
      </EmptyState>
    </div>
  );
}
