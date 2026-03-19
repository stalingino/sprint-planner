import type { Holiday } from '../../types';
import { C, inputStyle, btnStyle } from '../../constants';
import { api } from '../../api';

interface Props {
  holidays: Holiday[];
  onChange: (holidays: Holiday[]) => void;
  onNotify: (msg: string, type?: string) => void;
}

export function HolidayEditor({ holidays, onChange, onNotify }: Props) {
  async function handleAdd() {
    try {
      await api.holidays.create('', '');
      onChange(await api.holidays.list());
    } catch (e: any) {
      onNotify(e.message, 'error');
    }
  }

  async function handleUpdate(id: number, patch: Partial<Holiday>) {
    try {
      await api.holidays.update(id, patch);
      onChange(await api.holidays.list());
    } catch (e: any) {
      onNotify(e.message, 'error');
    }
  }

  async function handleRemove(id: number) {
    try {
      await api.holidays.remove(id);
      onChange(await api.holidays.list());
    } catch (e: any) {
      onNotify(e.message, 'error');
    }
  }

  const smallInput: React.CSSProperties = { ...inputStyle, fontSize: 10, padding: '3px 5px' };

  return (
    <div>
      <h3 style={{ color: C.orange, fontSize: 13, marginBottom: 8, fontFamily: "ui-monospace, monospace" }}>Holidays</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3, maxHeight: 160, overflowY: 'auto' }}>
        {holidays.map(h => (
          <div key={h.id} style={{ display: 'grid', gridTemplateColumns: '110px 1fr 20px', gap: 4, alignItems: 'center' }}>
            <input style={smallInput} type="date" value={h.date}
              onChange={e => handleUpdate(h.id, { date: e.target.value })} />
            <input style={smallInput} value={h.name}
              onChange={e => handleUpdate(h.id, { name: e.target.value })} />
            <button style={{ background: 'none', border: 'none', color: C.red, cursor: 'pointer', fontSize: 12 }}
              onClick={() => handleRemove(h.id)}>×</button>
          </div>
        ))}
        <button style={{ ...btnStyle(C.orange), padding: '3px 8px', fontSize: 10 }} onClick={handleAdd}>
          + Add Holiday
        </button>
      </div>
    </div>
  );
}
