import { useRef } from 'react';
import type { Developer } from '../../types';
import { C, inputStyle, devColors } from '../../constants';
import { api } from '../../api';

interface Props {
  developers: Developer[];
  onChange: (developers: Developer[]) => void;
  onNotify: (msg: string, type?: string) => void;
}

export function DeveloperEditor({ developers, onChange, onNotify }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleAdd(name: string) {
    if (!name.trim()) return;
    try {
      await api.developers.create(name.trim());
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
      <h3 style={{ color: C.teal, fontSize: 13, marginBottom: 10, fontFamily: "ui-monospace, monospace" }}>Developers</h3>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
        {developers.map((d, i) => (
          <span key={d.id} style={{
            display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 4,
            background: devColors[i % devColors.length] + '22', color: devColors[i % devColors.length],
            fontSize: 11, fontWeight: 600,
          }}>
            <button style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: 9, lineHeight: 1, padding: 0 }}
              onClick={() => handleReorder(d.id, -1)}>▲</button>
            {d.name}
            <button style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: 9, lineHeight: 1, padding: 0 }}
              onClick={() => handleReorder(d.id, 1)}>▼</button>
            <span style={{ cursor: 'pointer', opacity: 0.6 }} onClick={() => handleRemove(d.id)}>×</span>
          </span>
        ))}
      </div>
      <input
        ref={inputRef}
        style={{ ...inputStyle, width: 140, fontSize: 11, padding: '3px 6px' }}
        placeholder="+ Add developer"
        onKeyDown={e => {
          const input = e.target as HTMLInputElement;
          if (e.key === 'Enter' && input.value.trim()) {
            handleAdd(input.value.trim());
            input.value = '';
          }
        }}
      />
    </div>
  );
}
