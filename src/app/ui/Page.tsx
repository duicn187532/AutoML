import type { ReactNode } from 'react';
import { useT, type MessageKey } from '@/i18n';
import { Icon, MODULE_ICONS } from '../icons';
import { useUi, type ModuleId } from '../stores/ui';

/** Page title + one-line explanation of what the page is for, with optional actions on the right. */
export function PageHeader({ id, title, children }: { id: ModuleId; title?: string; children?: ReactNode }) {
  const t = useT();
  return (
    <header className="page-head">
      <div className="page-head-text">
        <h1>{title ?? t(`nav.${id}` as MessageKey)}</h1>
        <p className="page-desc">{t(`page.${id}.desc` as MessageKey)}</p>
      </div>
      {children && <div className="page-head-actions">{children}</div>}
    </header>
  );
}

/** Friendly empty state: icon, title, short explanation and the next action. */
export function EmptyState({ icon, title, body, children }: { icon: string; title: string; body: string; children?: ReactNode }) {
  return (
    <div className="empty" data-testid="empty-state">
      <div className="empty-icon"><Icon d={icon} size={30} /></div>
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
      <EmptyState icon={MODULE_ICONS.data} title={t('empty.needData.title')} body={t('empty.needData.body')}>
        <button className="primary big" onClick={() => useUi.getState().setModule('data')}>{t('empty.needData.go')} →</button>
      </EmptyState>
    </div>
  );
}
