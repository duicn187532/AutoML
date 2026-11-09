import { useState } from 'react';
import { useT, type MessageKey } from '@/i18n';
import { Icon, MODULE_ICONS } from './icons';
import { useProject } from './stores/project';
import { ADVANCED_MODULES, MAIN_MODULES, useUi, type ModuleId } from './stores/ui';
import { Paw } from './ui/Page';

const MORE_ICON = 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z';

/**
 * Left rail (desktop) / bottom bar (phone). The three workflow steps are a trail of paw prints
 * (filled = done, accent = here, pale = not yet); expert tools sit under "Advanced"
 * (on phones behind a "More" sheet).
 */
export function NavRail() {
  const t = useT();
  const { module, setModule } = useUi();
  // separate primitive selectors: a fresh object per call would re-render forever
  const hasData = useProject((s) => (s.project?.datasets.length ?? 0) > 0);
  const hasModel = useProject((s) => (s.project?.experiments.length ?? 0) > 0);
  const done: Partial<Record<ModuleId, boolean>> = { data: hasData, auto: hasModel };
  const [more, setMore] = useState(false);
  const advActive = ADVANCED_MODULES.includes(module);
  const go = (m: ModuleId) => { setModule(m); setMore(false); };
  return (
    <nav className="nav" aria-label="modules">
      <div className="nav-group nav-group-main">{t('nav.group.main')}</div>
      <div className="nav-main">
        {MAIN_MODULES.map((m, i) => (
          <button key={m} className={m === module ? 'nav-item step active' : 'nav-item step'} onClick={() => go(m)} aria-current={m === module ? 'page' : undefined} data-testid={`nav-${m}`}>
            <Paw state={m === module ? 'current' : done[m] ? 'done' : 'todo'} />
            <span className="nav-label"><span className="nav-num">{i + 1}</span>{t(`nav.${m}` as MessageKey)}</span>
          </button>
        ))}
      </div>
      <button className={advActive ? 'nav-item nav-more active' : 'nav-item nav-more'} onClick={() => setMore(!more)} aria-expanded={more} data-testid="nav-more">
        <span className="nav-icon"><Icon d={advActive ? MODULE_ICONS[module] : MORE_ICON} /></span>
        <span className="nav-label">{advActive ? t(`nav.${module}` as MessageKey) : t('nav.more')}</span>
      </button>
      {more && <div className="nav-sheet-backdrop" onClick={() => setMore(false)} aria-hidden="true" />}
      <div className={more ? 'nav-adv open' : 'nav-adv'}>
        <div className="nav-group">{t('nav.group.advanced')}</div>
        {ADVANCED_MODULES.map((m) => (
          <button key={m} className={m === module ? 'nav-item active' : 'nav-item'} onClick={() => go(m)} aria-current={m === module ? 'page' : undefined} data-testid={`nav-${m}`}>
            <span className="nav-icon"><Icon d={MODULE_ICONS[m]} /></span>
            <span className="nav-label">{t(`nav.${m}` as MessageKey)}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}
