import { C } from '../../constants';

interface ToastProps {
  msg: string;
  type: 'info' | 'success' | 'error';
}

export function Toast({ msg, type }: ToastProps) {
  const color = type === 'error' ? C.red : type === 'success' ? C.green : C.blue;
  return (
    <div style={{
      position: 'fixed', top: 16, right: 16, zIndex: 999, padding: '10px 20px', borderRadius: 8,
      background: color + '22', border: `1px solid ${color}44`, color,
      fontSize: 12, fontWeight: 600, maxWidth: 400,
      fontFamily: "ui-monospace, monospace",
    }}>
      {msg}
    </div>
  );
}
