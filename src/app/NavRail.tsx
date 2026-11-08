import { useT, type MessageKey } from '@/i18n';
import { MODULES, useUi, type ModuleId } from './stores/ui';

const ICONS: Record<ModuleId, string> = {
  data: 'M3 5h18v3H3zM3 10.5h18v3H3zM3 16h18v3H3z',
  auto: 'M12 2l2.4 6.6L21 11l-6.6 2.4L12 20l-2.4-6.6L3 11l6.6-2.4z',
  library: 'M4 4h4v16H4zM10 4h4v16h-4zM16.5 4.5l3.8 1-4 15.5-3.8-1z',
  dag: 'M5 3h5v5H5zM14 16h5v5h-5zM5 16h5v5H5zM7.5 8v8M7.5 12h9v4',
  experiments: 'M9 3h6M10 3v6l-5 9a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-9V3',
  script: 'M4 6l6 6-6 6M12 18h8',
};

export function NavRail() {
  const t = useT();
  const { module, setModule } = useUi();
  return (
    <nav className="nav" aria-label="modules">
      {MODULES.map((m) => (
        <button key={m} className={m === module ? 'nav-item active' : 'nav-item'} onClick={() => setModule(m)} aria-current={m === module ? 'page' : undefined} data-testid={`nav-${m}`}>
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
            <path d={ICONS[m]} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" strokeLinecap="round" />
          </svg>
          <span>{t(`nav.${m}` as MessageKey)}</span>
        </button>
      ))}
    </nav>
  );
}
