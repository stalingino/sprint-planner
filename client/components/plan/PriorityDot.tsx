import { useTheme } from '../../ThemeContext';
import PriorityHighestIcon from '@atlaskit/icon/core/priority-highest';
import PriorityHighIcon from '@atlaskit/icon/core/priority-high';
import PriorityMediumIcon from '@atlaskit/icon/core/priority-medium';
import PriorityLowIcon from '@atlaskit/icon/core/priority-low';
import PriorityLowestIcon from '@atlaskit/icon/core/priority-lowest';
import PriorityCriticalIcon from '@atlaskit/icon/core/priority-critical';
import PriorityBlockerIcon from '@atlaskit/icon/core/priority-blocker';

const PRIORITY_MAP: Record<string, { icon: React.ReactNode; color: string }> = {
  Highest:  { icon: <PriorityHighestIcon label="Highest" />,   color: '#f85149' },
  Critical: { icon: <PriorityCriticalIcon label="Critical" />, color: '#f85149' },
  Blocker:  { icon: <PriorityBlockerIcon label="Blocker" />,   color: '#f85149' },
  High:     { icon: <PriorityHighIcon label="High" />,         color: '#d29922' },
  Medium:   { icon: <PriorityMediumIcon label="Medium" />,     color: '#4a9eff' },
  Low:      { icon: <PriorityLowIcon label="Low" />,           color: '#7d8590' },
  Lowest:   { icon: <PriorityLowestIcon label="Lowest" />,     color: '#7d8590' },
};

export function PriorityDot({ priority }: { priority: string }) {
  const { C } = useTheme();
  const entry = PRIORITY_MAP[priority];
  const color = entry?.color ?? C.muted;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color, whiteSpace: 'nowrap' }}>
      <span style={{ display: 'inline-flex', verticalAlign: 'middle' }}>{entry?.icon ?? <PriorityMediumIcon label={priority} />}</span>
      {priority || '—'}
    </span>
  );
}
