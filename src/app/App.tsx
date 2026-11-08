import { Component, type ReactNode } from 'react';
import { AutoModule } from '@/modules/auto/AutoModule';
import { DataModule } from '@/modules/data/DataModule';
import { ExperimentsModule } from '@/modules/experiments/ExperimentsModule';
import { LibraryModule } from '@/modules/library/LibraryModule';
import { PlannedModule } from '@/modules/planned/PlannedModule';
import { NavRail } from './NavRail';
import { SidePanel } from './SidePanel';
import { TopBar } from './TopBar';
import { useUi } from './stores/ui';

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (this.state.error)
      return (
        <div className="error-box" role="alert">
          <strong>Error</strong>
          <pre>{this.state.error.message}</pre>
          <button onClick={() => this.setState({ error: null })}>OK</button>
        </div>
      );
    return this.props.children;
  }
}

export function App() {
  const module = useUi((s) => s.module);
  return (
    <div className="shell">
      <TopBar />
      <NavRail />
      <main className="main" data-module={module}>
        <ErrorBoundary key={module}>
          {module === 'data' && <DataModule />}
          {module === 'library' && <LibraryModule />}
          {module === 'experiments' && <ExperimentsModule />}
          {module === 'auto' && <AutoModule />}
          {(module === 'dag' || module === 'script') && <PlannedModule module={module} />}
        </ErrorBoundary>
      </main>
      <SidePanel />
    </div>
  );
}
