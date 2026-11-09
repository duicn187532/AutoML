import { useState } from 'react';
import { useT, type MessageKey } from '@/i18n';
import { Icon, MODULE_ICONS } from './icons';
import { ADVANCED_MODULES, MAIN_MODULES, useUi, type ModuleId } from './stores/ui';

const MORE_ICON = 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z';

/**
 * Left rail (desktop) / bottom bar (phone). The three workflow steps are numbered;
 * expert tools sit under "Advanced" (on phones behind a "More" sheet).
 */
export function NavRail() {
  const t = useT();
  const { module, setModule } = useUi();
  const [more, setMore] = useState(false);
  const advActive = ADVANCED_MODULES.includes(module);
  const item = (m: ModuleId, step?: number) => (
    <button key={m} className={m === module ? 'nav-item active' : 'nav-item'} onClick={() => { setModule(m); setMore(false); }} aria-current={m === module ? 'page' : undefined} data-testid={`nav-${m}`}>
      <span className="nav-icon">
        <Icon d={MODULE_ICONS[m]} />
        {step !== undefined && <span className="nav-step" aria-hidden="true">{step}</span>}
      </span>
      <span className="nav-label">{t(`nav.${m}` as MessageKey)}</span>
    </button>
  );
  return (
    <nav className="nav" aria-label="modules">
      <div className="nav-main">{MAIN_MODULES.map((m, i) => item(m, i + 1))}</div>
      <button className={advActive ? 'nav-item nav-more active' : 'nav-item nav-more'} onClick={() => setMore(!more)} aria-expanded={more} data-testid="nav-more">
        <span className="nav-icon"><Icon d={advActive ? MODULE_ICONS[module] : MORE_ICON} /></span>
        <span className="nav-label">{advActive ? t(`nav.${module}` as MessageKey) : t('nav.more')}</span>
      </button>
      {more && <div className="nav-sheet-backdrop" onClick={() => setMore(false)} aria-hidden="true" />}
      <div className={more ? 'nav-adv open' : 'nav-adv'}>
        <div className="nav-group">{t('nav.group.advanced')}</div>
        {ADVANCED_MODULES.map((m) => item(m))}
      </div>
    </nav>
  );
}
