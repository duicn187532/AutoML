import { useT, type MessageKey } from '@/i18n';
import { fmtDuration } from './format';
import { pool } from './services';
import { useProject } from './stores/project';
import { useTasks } from './stores/tasks';
import { useUi } from './stores/ui';

function DatasetsPanel() {
  const t = useT();
  const datasets = useProject((s) => s.project?.datasets ?? []);
  const { datasetId, selectDataset } = useUi();
  return (
    <section className="panel">
      <div className="panel-head">
        <h3>{t('panel.data')}</h3>
        <button className="link small" onClick={() => { selectDataset(null); useUi.getState().setModule('data'); }} data-testid="panel-import">+ {t('data.import')}</button>
      </div>
      {datasets.length === 0 && <p className="muted small">{t('panel.data.empty')}</p>}
      <ul className="list">
        {datasets.map((d) => (
          <li key={d.id}>
            <button className={d.id === datasetId ? 'list-item active' : 'list-item'} onClick={() => selectDataset(d.id)} data-testid="dataset-item">
              <span className="list-title">{d.images ? '🖼 ' : ''}{d.name}</span>
              <span className="muted small">
                {t('data.rows', { n: d.rowCount.toLocaleString() })} · {t('data.cols', { n: d.columns.length })}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function TasksPanel() {
  const t = useT();
  const { tasks, clearFinished, paused } = useTasks();
  return (
    <section className="panel grow">
      <div className="panel-head">
        <h3>{t('panel.tasks')}</h3>
        <button className="link small q-btn" title={paused ? t('task.resume') : t('task.pause')} aria-label={paused ? t('task.resume') : t('task.pause')} onClick={() => (paused ? pool.resume() : pool.pause())} data-testid="queue-pause">{paused ? '▶' : '❚❚'}</button>
        {tasks.some((x) => x.status !== 'running' && x.status !== 'queued') && (
          <button className="link small" onClick={clearFinished}>
            {t('task.clear')}
          </button>
        )}
      </div>
      {tasks.length === 0 && <p className="muted small">{t('panel.tasks.empty')}</p>}
      <ul className="list">
        {tasks.map((task) => {
          const active = task.status === 'running' || task.status === 'queued';
          const pct = Math.round((task.engineLoading ? task.engineLoading.fraction : task.fraction) * 100);
          return (
            <li key={task.id} className={`task ${task.status}`} data-testid="task" data-status={task.status}>
              <div className="task-row">
                <span className="list-title" title={task.label}>{task.label}</span>
                <span className={`badge ${task.status}`}>{t(`task.${task.status}` as MessageKey)}</span>
              </div>
              {active && (
                <>
                  <div className="progress" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
                    <div style={{ width: `${pct}%` }} />
                  </div>
                  <div className="task-row small muted">
                    <span>{task.engineLoading ? t('task.loadingEngine', { name: task.engineLoading.name, pct }) : task.message ?? `${pct}%`}</span>
                    <button className="link" onClick={() => pool.cancel(task.id)}>
                      {t('task.cancel')}
                    </button>
                  </div>
                </>
              )}
              {task.error && <div className="small error-text">{task.error}</div>}
              {task.endedAt && task.startedAt && <div className="small muted">{fmtDuration(task.endedAt - task.startedAt)}</div>}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function SidePanel() {
  const { drawer, setDrawer } = useUi();
  return (
    <>
      {drawer && <div className="drawer-backdrop" onClick={() => setDrawer(false)} aria-hidden="true" />}
      <aside className={drawer ? 'side open' : 'side'} id="side-panel">
        <button className="link drawer-close" onClick={() => setDrawer(false)} aria-label="close">✕</button>
        <DatasetsPanel />
        <TasksPanel />
      </aside>
    </>
  );
}
