import { useState, useEffect, useRef } from 'react';
import { btnStyle } from '../../constants';
import { useTheme } from '../../ThemeContext';
import { api } from '../../api';

interface Stats {
  size: number;
  taskCount: number;
  sprintCount: number;
  developerCount: number;
}

interface Props {
  onNotify: (msg: string, type?: string) => void;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

export function DbManager({ onNotify }: Props) {
  const { C } = useTheme();
  const [stats, setStats] = useState<Stats | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [restarting, setRestarting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.db.stats().then(setStats).catch(() => {});
  }, []);

  async function handleBackup() {
    try {
      const res = await api.db.backup();
      if (!res.ok) throw new Error('Backup failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const date = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `sprint-planner-${date}.db`;
      a.click();
      URL.revokeObjectURL(url);
      onNotify('Backup downloaded', 'success');
    } catch (e: any) {
      onNotify(`Backup failed: ${e.message}`, 'error');
    }
  }

  async function handleRestore(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith('.db') && !file.name.endsWith('.sqlite')) {
      onNotify('Select a .db or .sqlite file', 'error');
      return;
    }
    if (!confirm('This will replace all current data with the backup. Continue?')) {
      e.target.value = '';
      return;
    }
    setRestoring(true);
    try {
      await api.db.restore(file);
      setRestarting(true);
      onNotify('Restore complete — server is restarting…', 'success');
      const poll = setInterval(async () => {
        try {
          await fetch('/api/config');
          clearInterval(poll);
          window.location.reload();
        } catch { /* still restarting */ }
      }, 1500);
    } catch (e: any) {
      onNotify(`Restore failed: ${e.message}`, 'error');
      setRestoring(false);
    }
    e.target.value = '';
  }

  return (
    <div>
      <h3 style={{ color: C.teal, fontSize: 15, marginBottom: 12, fontFamily: 'ui-monospace, monospace' }}>
        Database
      </h3>

      {restarting ? (
        <div style={{ fontSize: 13, color: C.orange, fontWeight: 600, padding: '12px 0' }}>
          ⟳ Server restarting… page will reload automatically
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {stats && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 13 }}>
              <div style={{ color: C.muted }}>Size: <span style={{ color: C.text, fontWeight: 600 }}>{formatBytes(stats.size)}</span></div>
              <div style={{ color: C.muted }}>Tasks: <span style={{ color: C.text, fontWeight: 600 }}>{stats.taskCount}</span></div>
              <div style={{ color: C.muted }}>Sprints: <span style={{ color: C.text, fontWeight: 600 }}>{stats.sprintCount}</span></div>
              <div style={{ color: C.muted }}>Devs: <span style={{ color: C.text, fontWeight: 600 }}>{stats.developerCount}</span></div>
            </div>
          )}

          <div>
            <button style={btnStyle(C.blue)} onClick={handleBackup}>
              ↓ Download Backup
            </button>
            <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>
              Downloads a consistent snapshot of the database.
            </div>
          </div>

          <div>
            <button
              style={btnStyle(C.orange)}
              onClick={() => fileRef.current?.click()}
              disabled={restoring}
            >
              {restoring ? 'Restoring…' : '↑ Restore from Backup'}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".db,.sqlite"
              style={{ display: 'none' }}
              onChange={handleRestore}
            />
            <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>
              Replaces all data with the backup file. The server will restart automatically.<br />
              Requires container started with <code style={{ color: C.purple }}>--restart=unless-stopped</code>.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
