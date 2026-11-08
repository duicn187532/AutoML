import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import 'uplot/dist/uPlot.min.css';
import './styles.css';
import { App } from './app/App';
import { useProject } from './app/stores/project';
import { pool } from './app/services';
import { useLocale } from './i18n';

document.documentElement.lang = useLocale.getState().locale === 'zh-TW' ? 'zh-Hant' : 'en';

// Diagnostics hook for E2E tests (opt-in via URL hash, exposes nothing sensitive).
if (location.hash.includes('aml-debug')) Object.assign(window, { __aml: { pool } });

const root = createRoot(document.getElementById('root')!);
useProject
  .getState()
  .init()
  .catch((e) => console.error('Project init failed', e))
  .finally(() => {
    root.render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
  });
