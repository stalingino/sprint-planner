import { createRoot } from 'react-dom/client';
import { useState, useEffect, useCallback } from 'react';
import { btnStyle } from './constants';
import { ThemeProvider, useTheme } from './ThemeContext';
import { Toast } from './components/layout/Toast';
import { PlanPage } from './pages/PlanPage';
import { ConfigPage } from './pages/ConfigPage';
import { api } from './api';

type Page = 'plan' | 'config';

function App() {
  const { C } = useTheme();
  const [page, setPage] = useState<Page>('plan');
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null);
  const [jiraConnected, setJiraConnected] = useState(false);

  useEffect(() => {
    api.config.get()
      .then(cfg => setJiraConnected(cfg.jiraConnected))
      .catch(() => {});
  }, []);

  const notify = useCallback((msg: string, type = 'info') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }, []);

  return (
    <div style={{
      background: C.bg, color: C.text, minHeight: '100vh',
      fontFamily: "'Inter', 'Segoe UI', sans-serif", fontSize: 14,
    }}>
      {toast && <Toast msg={toast.msg} type={toast.type as any} />}

      {/* Header */}
      <div style={{
        padding: '16px 24px', borderBottom: `1px solid ${C.border}`,
        display: 'flex', alignItems: 'center', gap: '1em',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <img src="/jira.svg" alt="" style={{ width: 32, height: 32 }} />
          <span style={{
            fontSize: 22, fontWeight: 800, letterSpacing: -1,
            fontFamily: 'ui-monospace, monospace', color: C.purple,
          }}>
            Sprint Planner
          </span>
          <span style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>Jira-synced</span>
          {jiraConnected && (
            <span style={{
              fontSize: 11, padding: '2px 8px', borderRadius: 10,
              background: C.green + '22', color: C.green, fontWeight: 700,
            }}>
              ● CONNECTED
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 2 }}>
          <button
            style={btnStyle(page === 'plan' ? C.purple : C.muted)}
            onClick={() => setPage('plan')}
          >
            📋 Plan
          </button>
          <button
            style={btnStyle(page === 'config' ? C.purple : C.muted)}
            onClick={() => setPage('config')}
          >
            ⚙ Config
          </button>
        </div>
      </div>

      {page === 'plan' && <PlanPage onNotify={notify} onJiraConnected={setJiraConnected} />}
      {page === 'config' && <ConfigPage onNotify={notify} onJiraConnected={setJiraConnected} />}
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  <ThemeProvider><App /></ThemeProvider>
);
