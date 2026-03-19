import { C } from '../../constants';

interface FieldProps {
  label: string;
  value: string | number | null | undefined;
  onChange?: (v: string) => void;
  type?: string;
  readOnly?: boolean;
}

export function Field({ label, value, onChange, type = 'text', readOnly = false }: FieldProps) {
  return (
    <div>
      <div style={{
        fontSize: 10, color: C.muted, marginBottom: 3, fontWeight: 600,
        textTransform: 'uppercase', letterSpacing: 0.5,
      }}>
        {label}
      </div>
      <input
        type={type}
        readOnly={readOnly}
        style={{
          background: readOnly ? C.surface2 : C.input, border: `1px solid ${C.border}`, borderRadius: 4,
          color: C.text, padding: '5px 8px', fontSize: 12, width: '100%', outline: 'none',
          fontFamily: "'JetBrains Mono', monospace", opacity: readOnly ? 0.6 : 1,
          boxSizing: 'border-box',
        }}
        value={value ?? ''}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
      />
    </div>
  );
}
