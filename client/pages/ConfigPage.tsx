import { useState, useEffect } from 'react';
import type { Sprint, Developer, Holiday, Config } from '../types';
import { C, btnStyle } from '../constants';
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

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 24, maxWidth: 1400 }}>
        {/* Jira Status */}
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: 16 }}>
          <h3 style={{ color: C.blue, fontSize: 13, marginBottom: 12, fontFamily: "'JetBrains Mono', monospace" }}>
            Jira Connection
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {config?.jiraBaseUrl && (
              <div style={{ fontSize: 11, color: C.muted }}>
                Instance: <span style={{ color: C.text, fontWeight: 600 }}>{config.jiraBaseUrl}</span>
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {config?.jiraConnected
                ? <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 10, background: C.green + '22', color: C.green, fontWeight: 700 }}>● CONNECTED</span>
                : <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 10, background: C.red + '22', color: C.red, fontWeight: 700 }}>● DISCONNECTED</span>
              }
            </div>
            <div style={{ fontSize: 10, color: C.muted }}>
              Credentials are set via environment variables (JIRA_BASE_URL, JIRA_EMAIL, JIRA_TOKEN)
            </div>
            <button style={btnStyle(C.green)} onClick={handleDiscover} disabled={discovering}>
              {discovering ? 'Discovering…' : 'Discover / Refresh Fields'}
            </button>
            {config && Object.keys(config.fieldMap).length > 0 && (
              <div style={{ fontSize: 10, color: C.muted, marginTop: 4 }}>
                <div style={{ marginBottom: 4, fontWeight: 600 }}>Mapped fields:</div>
                {Object.entries(config.fieldMap).map(([k, v]) => (
                  <span key={k} style={{
                    display: 'inline-block', margin: '2px 4px', padding: '1px 6px', borderRadius: 3,
                    background: C.purple + '18', color: C.purple, fontSize: 10,
                  }}>
                    {k.replace('__', ' → ')} = {v}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Sprints */}
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: 16 }}>
          <SprintEditor sprints={sprints} onChange={setSprints} onNotify={onNotify} />
        </div>

        {/* Developers + Holidays */}
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: 16, display: 'flex', flexDirection: 'column', gap: 20 }}>
          <DeveloperEditor developers={developers} onChange={setDevelopers} onNotify={onNotify} />
          <HolidayEditor holidays={holidays} onChange={setHolidays} onNotify={onNotify} />
        </div>

        {/* Database */}
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: 16 }}>
          <DbManager onNotify={onNotify} />
        </div>
      </div>
    </div>
  );
}
