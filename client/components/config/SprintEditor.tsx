import type { Sprint } from '../../types';
import { C, inputStyle, btnStyle } from '../../constants';
import { api } from '../../api';

interface Props {
  sprints: Sprint[];
  onChange: (sprints: Sprint[]) => void;
  onNotify: (msg: string, type?: string) => void;
}

export function SprintEditor({ sprints, onChange, onNotify }: Props) {
  async function handleAdd() {
    try {
      await api.sprints.create({
        name: `Sprint ${sprints.length + 1}`,
        start: '',
        end: '',
        status: 'Planned',
      });
      onChange(await api.sprints.list());
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

  const smallInput: React.CSSProperties = { ...inputStyle, fontSize: 11, padding: '4px 6px' };

  return (
    <div>
      <h3 style={{ color: C.green, fontSize: 13, marginBottom: 10, fontFamily: "'JetBrains Mono', monospace" }}>Sprints</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 220, overflowY: 'auto' }}>
        {sprints.map(sp => (
          <div key={sp.id} style={{ display: 'grid', gridTemplateColumns: '1fr 100px 100px 70px 24px', gap: 4, alignItems: 'center' }}>
            <input style={smallInput} value={sp.name}
              onChange={e => handleUpdate(sp.id, { name: e.target.value })} />
            <input style={smallInput} type="date" value={sp.start}
              onChange={e => handleUpdate(sp.id, { start: e.target.value })} />
            <input style={smallInput} type="date" value={sp.end}
              onChange={e => handleUpdate(sp.id, { end: e.target.value })} />
            <select style={{ ...smallInput, fontSize: 10, padding: '3px 4px' }} value={sp.status}
              onChange={e => handleUpdate(sp.id, { status: e.target.value })}>
              <option>Active</option>
              <option>Planned</option>
              <option>Completed</option>
            </select>
            <button style={{ background: 'none', border: 'none', color: C.red, cursor: 'pointer', fontSize: 14 }}
              onClick={() => handleRemove(sp.id)}>×</button>
          </div>
        ))}
        <button style={{ ...btnStyle(C.green), padding: '4px 10px', fontSize: 11 }} onClick={handleAdd}>
          + Add Sprint
        </button>
      </div>
    </div>
  );
}
