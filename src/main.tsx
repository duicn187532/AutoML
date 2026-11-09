import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import 'uplot/dist/uPlot.min.css';
import './styles.css';
import { App } from './app/App';
import { useProject } from './app/stores/project';
import { engineLoader, pool } from './app/services';
import * as actions from './app/actions';
import { useLocale } from './i18n';

document.documentElement.lang = useLocale.getState().locale === 'zh-TW' ? 'zh-Hant' : 'en';

// Diagnostics hook for E2E tests (opt-in via URL hash, exposes nothing sensitive).
if (location.hash.includes('aml-debug')) Object.assign(window, { __aml: { pool, engineLoader, actions } });

// Ask the browser not to evict saved projects under storage pressure (silently ignored where unsupported).
try { void navigator.storage?.persist?.().catch(() => undefined); } catch { /* file:// or old browser */ }

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
