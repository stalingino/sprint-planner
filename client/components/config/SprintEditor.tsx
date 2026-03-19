import { useState } from 'react';
import type { Sprint } from '../../types';
import { btnStyle } from '../../constants';
import { useTheme } from '../../ThemeContext';
import { api } from '../../api';

interface Props {
  sprints: Sprint[];
  onChange: (sprints: Sprint[]) => void;
  onNotify: (msg: string, type?: string) => void;
}

export function SprintEditor({ sprints, onChange, onNotify }: Props) {
  const { C, inputStyle } = useTheme();
  const [newName, setNewName] = useState('');

  async function handleAdd() {
    if (!newName.trim()) return;
    try {
      await api.sprints.create({ name: newName.trim(), start: '', end: '', status: 'Planned' });
      onChange(await api.sprints.list());
      setNewName('');
    } catch (e: any) {
      onNotify(e.message, 'error');
    }
  }

  async function handleUpdate(id: string, patch: Partial<Sprint>) {
    try {
      await api.sprints.update(id, patch);
      onChange(await api.sprints.list());
    } catch (e: any) {
      onNotify(e.message, 'error');
    }
  }

  async function handleRemove(id: string) {
    try {
      await api.sprints.remove(id);
      onChange(await api.sprints.list());
    } catch (e: any) {
      onNotify(e.message, 'error');
    }
  }

  const smallInput: React.CSSProperties = { ...inputStyle, fontSize: 13, padding: '6px 8px' };

  return (
    <div>
      <h3 style={{ color: C.green, fontSize: 15, marginBottom: 14, fontFamily: 'ui-monospace, monospace' }}>Sprints</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 320, overflowY: 'auto' }}>
        {sprints.map(sp => (
          <div key={sp.id} style={{ display: 'grid', gridTemplateColumns: '1fr 140px 140px 110px 28px', gap: 8, alignItems: 'center' }}>
            <input style={smallInput} value={sp.name}
              onChange={e => handleUpdate(sp.id, { name: e.target.value })} />
            <input style={smallInput} type="date" value={sp.start}
              onChange={e => handleUpdate(sp.id, { start: e.target.value })} />
            <input style={smallInput} type="date" value={sp.end}
              onChange={e => handleUpdate(sp.id, { end: e.target.value })} />
            <select style={{ ...smallInput, fontSize: 12, padding: '4px 6px' }} value={sp.status}
              onChange={e => handleUpdate(sp.id, { status: e.target.value })}>
              <option>Active</option>
              <option>Planned</option>
              <option>Completed</option>
            </select>
            <button style={{ background: 'none', border: 'none', color: C.red, cursor: 'pointer', fontSize: 16 }}
              onClick={() => handleRemove(sp.id)}>×</button>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
        <input
          style={{ ...smallInput, flex: 1 }}
          placeholder="Sprint name…"
          value={newName}
          onChange={e => setNewName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAdd()}
        />
        <button
          style={{ ...btnStyle(C.green), padding: '6px 16px', opacity: newName.trim() ? 1 : 0.4 }}
          onClick={handleAdd}
        >
          + Add
        </button>
      </div>
    </div>
  );
}
