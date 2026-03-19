import { useState, useEffect } from 'react';
import type { Sprint, Developer, Holiday, Config } from '../types';
import { btnStyle } from '../constants';
import { useTheme } from '../ThemeContext';
import { api } from '../api';
import { SprintEditor } from '../components/config/SprintEditor';
import { DeveloperEditor } from '../components/config/DeveloperEditor';
import { HolidayEditor } from '../components/config/HolidayEditor';
import { DbManager } from '../components/config/DbManager';

interface Props {
  onNotify: (msg: string, type?: string) => void;
  onJiraConnected: (v: boolean) => void;
}

export function ConfigPage({ onNotify, onJiraConnected }: Props) {
  const { C } = useTheme();
  const [config, setConfig] = useState<Config | null>(null);
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [developers, setDevelopers] = useState<Developer[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [discovering, setDiscovering] = useState(false);

  useEffect(() => {
    Promise.all([
      api.config.get(),
      api.sprints.list(),
      api.developers.list(),
      api.holidays.list(),
    ]).then(([cfg, s, d, h]) => {
      setConfig(cfg);
      setSprints(s);
      setDevelopers(d);
      setHolidays(h);
      onJiraConnected(cfg.jiraConnected);
    }).catch(e => onNotify(e.message, 'error'));
  }, []);

  async function handleDiscover() {
    setDiscovering(true);
    try {
      const result = await api.jira.discover();
      const cfg = await api.config.get();
      setConfig(cfg);
      onJiraConnected(cfg.jiraConnected);
      onNotify(`Connected! Found ${result.count}/5 custom fields`, 'success');
    } catch (e: any) {
      onNotify(`Field discovery failed: ${e.message}`, 'error');
    }
    setDiscovering(false);
  }

  const panel: React.CSSProperties = {
    background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 24,
  };

  return (
    <div style={{ padding: 32, display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* Row 1: Jira + Sprints */}
      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 24 }}>

        {/* Jira Connection */}
        <div style={panel}>
          <h3 style={{ color: C.blue, fontSize: 15, marginBottom: 16, fontFamily: 'ui-monospace, monospace' }}>
            Jira Connection
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {config?.jiraBaseUrl && (
              <div style={{ fontSize: 13, color: C.muted }}>
                Instance: <span style={{ color: C.text, fontWeight: 600 }}>{config.jiraBaseUrl}</span>
              </div>
            )}
            <div>
              {config?.jiraConnected
                ? <span style={{ fontSize: 13, padding: '4px 12px', borderRadius: 10, background: C.green + '22', color: C.green, fontWeight: 700 }}>● CONNECTED</span>
                : <span style={{ fontSize: 13, padding: '4px 12px', borderRadius: 10, background: C.red + '22', color: C.red, fontWeight: 700 }}>● DISCONNECTED</span>
              }
            </div>
            <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.6 }}>
              Credentials via env vars:<br />
              <code style={{ color: C.text }}>JIRA_BASE_URL · JIRA_EMAIL · JIRA_TOKEN</code>
            </div>
            <button style={btnStyle(C.green)} onClick={handleDiscover} disabled={discovering}>
              {discovering ? 'Discovering…' : 'Discover / Refresh Fields'}
            </button>
            {config && Object.keys(config.fieldMap).length > 0 && (
              <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>
                <div style={{ marginBottom: 6, fontWeight: 600 }}>Mapped fields:</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {Object.entries(config.fieldMap).map(([k, v]) => (
                    <span key={k} style={{
                      padding: '2px 8px', borderRadius: 4,
                      background: C.purple + '18', color: C.purple, fontSize: 11,
                    }}>
                      {k.replace('__', ' → ')} = {v}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Sprints */}
        <div style={panel}>
          <SprintEditor sprints={sprints} onChange={setSprints} onNotify={onNotify} />
        </div>
      </div>

      {/* Row 2: Developers + Holidays + Database */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 280px', gap: 24 }}>

        <div style={panel}>
          <DeveloperEditor developers={developers} onChange={setDevelopers} onNotify={onNotify} />
        </div>

        <div style={panel}>
          <HolidayEditor holidays={holidays} onChange={setHolidays} onNotify={onNotify} />
        </div>

        <div style={panel}>
          <DbManager onNotify={onNotify} />
        </div>
      </div>

    </div>
  );
}
