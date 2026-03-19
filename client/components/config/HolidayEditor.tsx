import type { Holiday } from '../../types';
import { btnStyle } from '../../constants';
import { useTheme } from '../../ThemeContext';
import { api } from '../../api';

interface Props {
  holidays: Holiday[];
  onChange: (holidays: Holiday[]) => void;
  onNotify: (msg: string, type?: string) => void;
}

export function HolidayEditor({ holidays, onChange, onNotify }: Props) {
  const { C, inputStyle } = useTheme();

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

  const smallInput: React.CSSProperties = { ...inputStyle, fontSize: 13, padding: '5px 7px' };

  return (
    <div>
      <h3 style={{ color: C.orange, fontSize: 15, marginBottom: 8, fontFamily: 'ui-monospace, monospace' }}>Holidays</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5, maxHeight: 200, overflowY: 'auto' }}>
        {holidays.map(h => (
          <div key={h.id} style={{ display: 'grid', gridTemplateColumns: '130px 1fr 24px', gap: 6, alignItems: 'center' }}>
            <input style={smallInput} type="date" value={h.date}
              onChange={e => handleUpdate(h.id, { date: e.target.value })} />
            <input style={smallInput} value={h.name}
              onChange={e => handleUpdate(h.id, { name: e.target.value })} />
            <button style={{ background: 'none', border: 'none', color: C.red, cursor: 'pointer', fontSize: 16 }}
              onClick={() => handleRemove(h.id)}>×</button>
          </div>
        ))}
        <button style={{ ...btnStyle(C.orange), padding: '5px 10px', fontSize: 12, alignSelf: 'flex-start' }} onClick={handleAdd}>
          + Add Holiday
        </button>
      </div>
    </div>
  );
}
