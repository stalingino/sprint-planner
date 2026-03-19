import { useState } from 'react';
import type { Task, Sprint, Holiday } from '../../types';
import { useTheme } from '../../ThemeContext';
import { StatusBadge } from './StatusBadge';
import { parseDate, formatDisplay, isWorkingDay } from '../../dateUtils';

interface Props {
  tasks: Task[];
  sprints: Sprint[];
  developers: string[];
  holidays: Holiday[];
  devColors: string[];
}

export function WorkloadView({ tasks, sprints, developers, holidays, devColors }: Props) {
  const { C, inputStyle } = useTheme();
  const [selSprint, setSelSprint] = useState(sprints[0]?.name || '');
  const sprint = sprints.find(s => s.name === selSprint);
  const sprintTasks = tasks.filter(t => t.sprint === selSprint);

  const workingDays = sprint ? (() => {
    const start = parseDate(sprint.start);
    const end = parseDate(sprint.end);
    if (!start || !end) return 0;
    let count = 0;
    const d = new Date(start);
    while (d <= end) {
      if (isWorkingDay(d, holidays)) count++;
      d.setDate(d.getDate() + 1);
    }
    return count;
  })() : 0;

  return (
    <div style={{ padding: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <span style={{ fontSize: 13, color: C.muted, fontWeight: 600 }}>Sprint:</span>
        <select
          style={{ background: C.input, border: `1px solid ${C.border}`, color: C.purple, fontSize: 14, borderRadius: 6, padding: '6px 12px', fontWeight: 700 }}
          value={selSprint}
          onChange={e => setSelSprint(e.target.value)}
        >
          {sprints.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
        </select>
        {sprint && (
          <span style={{ fontSize: 13, color: C.muted }}>
            {formatDisplay(parseDate(sprint.start))} → {formatDisplay(parseDate(sprint.end))}
            {' · '}
            <span style={{ color: C.green, fontWeight: 700 }}>{workingDays} working days</span>
          </span>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(270px, 1fr))', gap: 14 }}>
        {developers.map((dev, di) => {
          const devTasks = sprintTasks.filter(t => t.developer === dev);
          const totalEffort = devTasks.reduce((s, t) => s + (t.effortDays || 0), 0);
          const done = devTasks.filter(t => t.status === 'Done').length;
          const util = workingDays > 0 ? totalEffort / workingDays : 0;
          const color = devColors[di % devColors.length];
          const overloaded = util > 1;

          return (
            <div key={dev} style={{
              background: C.surface2, borderRadius: 8, padding: 18,
              border: `1px solid ${overloaded ? C.red + '44' : C.border}`,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <span style={{ fontSize: 15, fontWeight: 700, color }}>{dev}</span>
                <span style={{
                  fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 4,
                  background: overloaded ? C.red + '22' : util > 0.8 ? C.orange + '22' : C.green + '22',
                  color: overloaded ? C.red : util > 0.8 ? C.orange : C.green,
                }}>
                  {Math.round(util * 100)}%
                </span>
              </div>
              <div style={{ height: 6, borderRadius: 3, background: C.border, marginBottom: 12, overflow: 'hidden' }}>
                <div style={{
                  height: '100%', borderRadius: 3, width: `${Math.min(100, util * 100)}%`,
                  background: overloaded ? C.red : util > 0.8 ? C.orange : color, transition: 'width .3s',
                }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, fontSize: 12 }}>
                <div style={{ color: C.muted }}>Tasks: <span style={{ color: C.text, fontWeight: 600 }}>{devTasks.length}</span></div>
                <div style={{ color: C.muted }}>Effort: <span style={{ color: C.orange, fontWeight: 600 }}>{totalEffort}d</span></div>
                <div style={{ color: C.muted }}>Done: <span style={{ color: C.green, fontWeight: 600 }}>{done}</span></div>
                <div style={{ color: C.muted }}>Left: <span style={{ color: C.teal, fontWeight: 600 }}>{Math.max(0, workingDays - totalEffort)}d</span></div>
              </div>
              {devTasks.length > 0 && (
                <div style={{ marginTop: 10, borderTop: `1px solid ${C.border}`, paddingTop: 8 }}>
                  {devTasks.map(t => (
                    <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0', fontSize: 12 }}>
                      <StatusBadge status={t.status} />
                      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.summary}</span>
                      <span style={{ color: C.orange, fontWeight: 700 }}>{t.effortDays}d</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
