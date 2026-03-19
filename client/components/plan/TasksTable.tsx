import { useState } from 'react';
import type { Task, Sprint, Developer } from '../../types';
import { btnPill } from '../../constants';
import { useTheme } from '../../ThemeContext';
import BugIcon from '@atlaskit/icon/core/bug';
import StoryIcon from '@atlaskit/icon/core/story';
import EpicIcon from '@atlaskit/icon/core/epic';
import TaskIcon from '@atlaskit/icon/core/task';
import SubtasksIcon from '@atlaskit/icon/core/subtasks';
import { PriorityDot } from './PriorityDot';
import { Field } from './Field';
import { parseDate, formatDisplay } from '../../dateUtils';

interface Props {
  tasks: Task[];
  sprints: Sprint[];
  developers: Developer[];
  syncing: Record<string, boolean>;
  devColors: string[];
  jiraBaseUrl: string;
  onUpdate: (id: string, patch: Partial<Task>) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
  onMove: (id: string, direction: number) => Promise<void>;
  onPull: (key: string) => Promise<void>;
  onPush: (task: Task) => Promise<void>;
}

export function TasksTable({ tasks, sprints, developers, syncing, devColors, jiraBaseUrl, onUpdate, onRemove, onMove, onPull, onPush }: Props) {
  const { C } = useTheme();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const devNames = developers.map(d => d.name);

  function typeIcon(type: string) {
    const ic = (color: string, el: React.ReactNode) => (
      <span style={{ color, display: 'inline-flex', verticalAlign: 'middle' }}>{el}</span>
    );
    switch (type?.toLowerCase()) {
      case 'bug':      return ic('#f85149', <BugIcon label={type} />);
      case 'story':    return ic('#3fb950', <StoryIcon label={type} />);
      case 'epic':     return ic('#bc8cff', <EpicIcon label={type} />);
      case 'subtask':
      case 'sub-task': return ic('#4a9eff', <SubtasksIcon label={type} />);
      default:         return ic('#4a9eff', <TaskIcon label={type} />);
    }
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ background: C.surface2 }}>
            {['', 'Key', 'Task', 'Priority', 'Sprint', 'Developer', 'Effort', 'Status', 'Start', 'End', 'Spill?', 'Jira Sync', ''].map((h, i) => (
              <th key={i} style={{
                padding: '10px 8px', color: C.muted, fontWeight: 700, fontSize: 11,
                textTransform: 'uppercase', letterSpacing: 1, textAlign: 'left',
                borderBottom: `1px solid ${C.border}`, whiteSpace: 'nowrap',
              }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {tasks.map((t, idx) => {
            const sprintObj = sprints.find(s => s.name === t.sprint);
            const spill = t.endDate && sprintObj && t.endDate > sprintObj.end;
            const isExpanded = expanded[t.id];
            const devIdx = devNames.indexOf(t.developer);
            const devColor = devColors[devIdx >= 0 ? devIdx % devColors.length : 0];

            return [
              <tr key={t.id} style={{ background: idx % 2 ? C.surface2 : C.surface, borderBottom: `1px solid ${C.border}22` }}>
                {/* Reorder */}
                <td style={{ padding: '6px 4px', textAlign: 'center', width: 40 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                    <button style={{ background: 'none', border: 'none', color: C.muted, cursor: 'pointer', fontSize: 11, lineHeight: 1 }}
                      onClick={() => onMove(t.id, -1)}>▲</button>
                    <button style={{ background: 'none', border: 'none', color: C.muted, cursor: 'pointer', fontSize: 11, lineHeight: 1 }}
                      onClick={() => onMove(t.id, 1)}>▼</button>
                  </div>
                </td>
                {/* Key */}
                <td style={{ padding: '6px 8px', fontWeight: 700, fontFamily: 'ui-monospace, monospace', fontSize: 12, whiteSpace: 'nowrap' }}>
                  <span style={{ marginRight: 4 }} title={t.type}>{typeIcon(t.type)}</span>
                  {t.jiraKey
                    ? <a href={`${jiraBaseUrl}/browse/${t.jiraKey}`} target="_blank" rel="noreferrer"
                        style={{ color: C.blue, textDecoration: 'none' }}
                        onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')}
                        onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}
                      >{t.jiraKey}</a>
                    : <span style={{ color: C.muted, fontStyle: 'italic' }}>local</span>}
                </td>
                {/* Summary */}
                <td style={{ padding: '6px 8px', maxWidth: 260 }}>
                  <input
                    style={{ background: 'transparent', border: 'none', color: C.text, fontSize: 13, width: '100%', outline: 'none', fontWeight: 500 }}
                    value={t.summary}
                    onChange={e => onUpdate(t.id, { summary: e.target.value })}
                  />
                </td>
                {/* Priority */}
                <td style={{ padding: '6px 6px' }}><PriorityDot priority={t.priority} /></td>
                {/* Sprint */}
                <td style={{ padding: '6px 6px' }}>
                  <select
                    style={{ background: C.input, border: `1px solid ${C.border}`, color: C.purple, fontSize: 12, borderRadius: 4, padding: '4px 6px', fontWeight: 600 }}
                    value={t.sprint}
                    onChange={e => onUpdate(t.id, { sprint: e.target.value })}
                  >
                    <option value="">—</option>
                    {sprints.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                  </select>
                </td>
                {/* Developer */}
                <td style={{ padding: '6px 6px' }}>
                  <select
                    style={{ background: C.input, border: `1px solid ${C.border}`, color: devColor, fontSize: 12, borderRadius: 4, padding: '4px 6px', fontWeight: 600 }}
                    value={t.developer}
                    onChange={e => onUpdate(t.id, { developer: e.target.value })}
                  >
                    <option value="">—</option>
                    {developers.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
                  </select>
                </td>
                {/* Effort */}
                <td style={{ padding: '6px 6px', textAlign: 'center' }}>
                  <input
                    type="number" min="0.5" step="0.5"
                    style={{ background: C.input, border: `1px solid ${C.border}`, color: C.orange, fontSize: 13, width: 52, textAlign: 'center', borderRadius: 4, padding: '4px 4px', fontWeight: 700 }}
                    value={t.effortDays || ''}
                    onChange={e => onUpdate(t.id, { effortDays: parseFloat(e.target.value) || 0 })}
                  />
                </td>
                {/* Status */}
                <td style={{ padding: '6px 6px' }}>
                  <select
                    style={{ background: C.input, border: `1px solid ${C.border}`, color: C.text, fontSize: 12, borderRadius: 4, padding: '4px 6px' }}
                    value={t.status}
                    onChange={e => onUpdate(t.id, { status: e.target.value })}
                  >
                    {['To Do', 'In Progress', 'In Review', 'Done', 'Blocked', 'Carried Over'].map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </td>
                {/* Start */}
                <td style={{ padding: '6px 6px', fontSize: 12, color: C.green, fontFamily: 'ui-monospace, monospace', whiteSpace: 'nowrap' }}>
                  {formatDisplay(parseDate(t.startDate))}
                </td>
                {/* End */}
                <td style={{ padding: '6px 6px', fontSize: 12, color: C.orange, fontFamily: 'ui-monospace, monospace', whiteSpace: 'nowrap' }}>
                  {formatDisplay(parseDate(t.endDate))}
                </td>
                {/* Spill */}
                <td style={{ padding: '6px 6px', textAlign: 'center' }}>
                  {spill
                    ? <span style={{ color: C.red, fontWeight: 700, fontSize: 13 }}>⚠</span>
                    : t.endDate ? <span style={{ color: C.green, fontSize: 13 }}>✓</span> : ''}
                </td>
                {/* Sync */}
                <td style={{ padding: '6px 6px' }}>
                  {t.jiraKey && (
                    <div style={{ display: 'flex', gap: 3 }}>
                      <button title="Pull from Jira" style={{ ...btnPill(C.blue), opacity: syncing[t.id] ? 0.5 : 1 }}
                        onClick={() => onPull(t.jiraKey)} disabled={syncing[t.id]}>↓</button>
                      <button title="Push to Jira" style={{ ...btnPill(C.orange), opacity: syncing[t.id] ? 0.5 : 1 }}
                        onClick={() => onPush(t)} disabled={syncing[t.id]}>↑</button>
                    </div>
                  )}
                </td>
                {/* Expand / Delete */}
                <td style={{ padding: '6px 6px' }}>
                  <div style={{ display: 'flex', gap: 3 }}>
                    <button style={btnPill(C.purple)} onClick={() => setExpanded(ex => ({ ...ex, [t.id]: !isExpanded }))}>
                      {isExpanded ? '▾' : '▸'}
                    </button>
                    <button style={btnPill(C.red)} onClick={() => onRemove(t.id)}>×</button>
                  </div>
                </td>
              </tr>,
              isExpanded && (
                <tr key={t.id + '_exp'} style={{ background: C.surface2 }}>
                  <td colSpan={13} style={{ padding: '14px 20px 18px 60px', borderBottom: `1px solid ${C.border}` }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, maxWidth: 720 }}>
                      <Field label="Dev ETA (Date)" value={t.devEta} type="date" onChange={v => onUpdate(t.id, { devEta: v })} />
                      {t.effortL0Num !== null
                        ? <Field label="Dev Effort L0 · num" value={t.effortL0Num} type="number" onChange={v => onUpdate(t.id, { effortL0Num: v ? parseFloat(v) : null })} />
                        : t.effortL0Txt
                          ? <Field label="Dev Effort L0 · txt" value={t.effortL0Txt} onChange={v => onUpdate(t.id, { effortL0Txt: v })} />
                          : null}
                      {t.effortL1Num !== null
                        ? <Field label="Dev Effort L1 · num" value={t.effortL1Num} type="number" onChange={v => onUpdate(t.id, { effortL1Num: v ? parseFloat(v) : null })} />
                        : t.effortL1Txt
                          ? <Field label="Dev Effort L1 · txt" value={t.effortL1Txt} onChange={v => onUpdate(t.id, { effortL1Txt: v })} />
                          : null}
                      <Field label="Assignee (Jira)" value={t.assignee || '—'} readOnly />
                      <div style={{ gridColumn: '1 / -1' }}>
                        <Field label="Notes" value={t.notes} onChange={v => onUpdate(t.id, { notes: v })} />
                      </div>
                    </div>
                    {t.lastSynced && (
                      <div style={{ fontSize: 11, color: C.muted, marginTop: 8 }}>
                        Last synced: {new Date(t.lastSynced).toLocaleString()}
                      </div>
                    )}
                  </td>
                </tr>
              ),
            ];
          })}
          {tasks.length === 0 && (
            <tr>
              <td colSpan={13} style={{ padding: 40, textAlign: 'center', color: C.muted }}>
                No tasks yet. Enter a Jira issue key above or add a manual task.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
