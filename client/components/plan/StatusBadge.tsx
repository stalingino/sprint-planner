import { C } from '../../constants';

const colors: Record<string, string> = {
  'To Do': C.muted, 'In Progress': C.blue, 'In Review': C.orange,
  Done: C.green, Blocked: C.red, 'Carried Over': C.purple,
};

export function StatusBadge({ status }: { status: string }) {
  const color = colors[status] || C.muted;
  return (
    <span style={{
      fontSize: 11, padding: '2px 8px', borderRadius: 4,
      background: color + '22', color, fontWeight: 600, whiteSpace: 'nowrap',
    }}>
      {status || '—'}
    </span>
  );
}
