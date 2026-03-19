import { C } from '../../constants';

const colors: Record<string, string> = {
  Critical: C.red, High: C.orange, Medium: C.blue, Low: C.muted,
};

export function PriorityDot({ priority }: { priority: string }) {
  const color = colors[priority] || C.muted;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color }}>
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: color }} />
      {priority || '—'}
    </span>
  );
}
