import { useRef, useState, useEffect } from 'react';
import type { Developer } from '../../types';
import { devColors } from '../../constants';
import { useTheme } from '../../ThemeContext';
import { api } from '../../api';

interface JiraUser {
  accountId: string;
  displayName: string;
  email: string;
  avatarUrl: string;
}

interface Props {
  developers: Developer[];
  onChange: (developers: Developer[]) => void;
  onNotify: (msg: string, type?: string) => void;
}

export function DeveloperEditor({ developers, onChange, onNotify }: Props) {
  const { C, inputStyle } = useTheme();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<JiraUser[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  function handleQueryChange(value: string) {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!value.trim()) { setResults([]); setOpen(false); return; }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const users = await api.jira.searchUsers(value.trim());
        setResults(users);
        setOpen(true);
      } catch {
        setResults([]);
        setOpen(false);
      } finally {
        setLoading(false);
      }
    }, 300);
  }

  async function handleSelect(user: JiraUser) {
    setOpen(false);
    setQuery('');
    setResults([]);
    await addDeveloper(user.displayName, user.accountId);
  }

  async function handleAddPlain() {
    const name = query.trim();
    if (!name) return;
    setQuery('');
    setOpen(false);
    await addDeveloper(name, null);
  }

  async function addDeveloper(name: string, jiraAccountId: string | null) {
    try {
      await api.developers.create(name, jiraAccountId);
      onChange(await api.developers.list());
    } catch (e: any) {
      onNotify(e.message, 'error');
    }
  }

  async function handleRemove(id: number) {
    try {
      await api.developers.remove(id);
      onChange(await api.developers.list());
    } catch (e: any) {
      onNotify(e.message, 'error');
    }
  }

  async function handleReorder(id: number, direction: number) {
    try {
      onChange(await api.developers.reorder(id, direction));
    } catch (e: any) {
      onNotify(e.message, 'error');
    }
  }

  return (
    <div>
      <h3 style={{ color: C.teal, fontSize: 15, marginBottom: 10, fontFamily: 'ui-monospace, monospace' }}>Developers</h3>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
        {developers.map((d, i) => (
          <span key={d.id} style={{
            display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 4,
            background: devColors[i % devColors.length] + '22', color: devColors[i % devColors.length],
            fontSize: 13, fontWeight: 600,
          }}>
            <button style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: 10, lineHeight: 1, padding: 0 }}
              onClick={() => handleReorder(d.id, -1)}>▲</button>
            {d.name}
            {d.jiraAccountId && (
              <span title="Linked to Jira" style={{ fontSize: 10, opacity: 0.7 }}>⬡</span>
            )}
            <button style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: 10, lineHeight: 1, padding: 0 }}
              onClick={() => handleReorder(d.id, 1)}>▼</button>
            <span style={{ cursor: 'pointer', opacity: 0.6 }} onClick={() => handleRemove(d.id)}>×</span>
          </span>
        ))}
      </div>

      {/* Combobox */}
      <div ref={wrapperRef} style={{ position: 'relative', display: 'inline-block' }}>
        <input
          style={{ ...inputStyle, width: 220, fontSize: 13, padding: '5px 8px' }}
          placeholder="+ Search Jira or add name…"
          value={query}
          onChange={e => handleQueryChange(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') handleAddPlain();
            if (e.key === 'Escape') { setOpen(false); setQuery(''); }
          }}
        />
        {loading && (
          <span style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: C.muted }}>…</span>
        )}
        {open && results.length > 0 && (
          <div style={{
            position: 'absolute', top: '100%', left: 0, zIndex: 100,
            background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 6,
            minWidth: 280, maxHeight: 240, overflowY: 'auto', marginTop: 2,
            boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
          }}>
            {results.map(u => (
              <div
                key={u.accountId}
                onMouseDown={() => handleSelect(u)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '8px 12px', cursor: 'pointer', fontSize: 13,
                  borderBottom: `1px solid ${C.border}22`,
                }}
                onMouseEnter={e => (e.currentTarget.style.background = C.surface)}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                {u.avatarUrl && (
                  <img src={u.avatarUrl} alt="" style={{ width: 22, height: 22, borderRadius: '50%', flexShrink: 0 }} />
                )}
                <div>
                  <div style={{ color: C.text, fontWeight: 600 }}>{u.displayName}</div>
                  {u.email && <div style={{ color: C.muted, fontSize: 11 }}>{u.email}</div>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
