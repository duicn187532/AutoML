import type { ModuleId } from './stores/ui';

export const MODULE_ICONS: Record<ModuleId, string> = {
  data: 'M4 6c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3zM4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3',
  auto: 'M12 3l2.1 5.4L19.5 10.5l-5.4 2.1L12 18l-2.1-5.4L4.5 10.5l5.4-2.1zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z',
  library: 'M4 4h4v16H4zM10 4h4v16h-4zM16.5 4.5l3.8 1-4 15.5-3.8-1z',
  dag: 'M4 4h6v5H4zM14 15h6v5h-6zM4 15h6v5H4zM7 9v6M7 12h10v3',
  experiments: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  script: 'M4 6l6 6-6 6M12 18h8',
};

export function Icon({ d, size = 22, className }: { d: string; size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" className={className}>
      <path d={d} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
