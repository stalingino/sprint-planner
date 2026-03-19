import { useRef, useEffect } from 'react';
import type { Task, Sprint, Holiday } from '../../types';
import { C } from '../../constants';
import { parseDate, formatDate, isWeekend, isHoliday, eachDay } from '../../dateUtils';

interface Props {
  tasks: Task[];
  sprints: Sprint[];
  holidays: Holiday[];
  devColors: string[];
  developers: string[];
}

export function TimelineView({ tasks, sprints, holidays, devColors, developers }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const cellW = 28;
  const rowH = 28;
  const labelW = 320;

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const activeTasks = tasks.filter(t => t.startDate && t.endDate && t.developer);

  const timelineStart = sprints.length
    ? new Date(Math.min(...sprints.map(s => parseDate(s.start)?.getTime() ?? Infinity)))
    : new Date();
  const timelineEnd = sprints.length
    ? new Date(Math.max(...sprints.map(s => parseDate(s.end)?.getTime() ?? 0)) + 14 * 86400000)
    : new Date(Date.now() + 30 * 86400000);
  const timelineDays = eachDay(timelineStart, timelineEnd);

  const sprintBand = timelineDays.map(d => {
    const ds = formatDate(d);
    return sprints.find(s => ds >= s.start && ds <= s.end)?.name || '';
  });

  useEffect(() => {
    if (scrollRef.current) {
      const todayIdx = timelineDays.findIndex(d => formatDate(d) === formatDate(today));
      if (todayIdx > 5) scrollRef.current.scrollLeft = (todayIdx - 5) * cellW;
    }
  }, []);

  return (
    <div style={{ display: 'flex', overflow: 'hidden' }}>
      {/* Fixed left: task labels */}
      <div style={{ minWidth: labelW, maxWidth: labelW, borderRight: `1px solid ${C.border}`, background: C.surface }}>
        <div style={{
          height: rowH * 2, borderBottom: `1px solid ${C.border}`,
          display: 'flex', alignItems: 'flex-end', padding: '0 12px 6px',
          fontWeight: 700, fontSize: 10, color: C.muted, textTransform: 'uppercase', letterSpacing: 1,
        }}>
          <span style={{ flex: 1 }}>Task</span>
          <span style={{ width: 80, textAlign: 'center' }}>Developer</span>
          <span style={{ width: 40, textAlign: 'center' }}>Days</span>
        </div>
        {activeTasks.map((t, i) => {
          const devIdx = developers.indexOf(t.developer);
          const color = devColors[devIdx >= 0 ? devIdx % devColors.length : 0];
          return (
            <div key={t.id} style={{
              height: rowH, display: 'flex', alignItems: 'center', padding: '0 12px',
              borderBottom: `1px solid ${C.border}11`, background: i % 2 ? C.surface2 : C.surface, gap: 6,
            }}>
              {t.jiraKey && (
                <span style={{ fontSize: 9, color: C.blue, fontFamily: "ui-monospace, monospace", fontWeight: 700, minWidth: 60 }}>
                  {t.jiraKey}
                </span>
              )}
              <span style={{ flex: 1, fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.summary}</span>
              <span style={{ width: 80, fontSize: 10, color, fontWeight: 600, textAlign: 'center' }}>{t.developer}</span>
              <span style={{ width: 40, fontSize: 10, color: C.orange, textAlign: 'center', fontWeight: 700 }}>{t.effortDays}</span>
            </div>
          );
        })}
      </div>

      {/* Scrollable right: Gantt grid */}
      <div ref={scrollRef} style={{ flex: 1, overflowX: 'auto', overflowY: 'hidden' }}>
        <div style={{ minWidth: timelineDays.length * cellW }}>
          {/* Sprint band */}
          <div style={{ display: 'flex', height: rowH, borderBottom: `1px solid ${C.border}33` }}>
            {timelineDays.map((d, di) => {
              const sName = sprintBand[di];
              const prevName = di > 0 ? sprintBand[di - 1] : '';
              const showLabel = sName && sName !== prevName;
              return (
                <div key={di} style={{
                  width: cellW, minWidth: cellW, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 8, fontWeight: 700, color: sName ? C.purple : C.muted,
                  background: sName ? C.purple + '0a' : 'transparent',
                  borderLeft: showLabel ? `2px solid ${C.purple}55` : 'none', position: 'relative',
                }}>
                  {showLabel && (
                    <span style={{ position: 'absolute', left: 4, fontSize: 9, whiteSpace: 'nowrap', color: C.purple, fontFamily: "ui-monospace, monospace" }}>
                      {sName}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
          {/* Day numbers */}
          <div style={{ display: 'flex', height: rowH, borderBottom: `1px solid ${C.border}` }}>
            {timelineDays.map((d, di) => {
              const wknd = isWeekend(d);
              const hol = isHoliday(d, holidays);
              const isToday = formatDate(d) === formatDate(today);
              const isFirst = d.getDate() === 1;
              return (
                <div key={di} style={{
                  width: cellW, minWidth: cellW, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  background: isToday ? C.green + '22' : hol ? C.red + '0c' : wknd ? C.surface2 : 'transparent',
                  borderLeft: isFirst ? `1px solid ${C.blue}44` : 'none', position: 'relative',
                }}>
                  {isFirst && (
                    <span style={{ fontSize: 7, color: C.blue, fontWeight: 700, position: 'absolute', top: 1 }}>
                      {d.toLocaleDateString('en', { month: 'short' })}
                    </span>
                  )}
                  <span style={{
                    fontSize: 10, fontWeight: isToday ? 800 : 600,
                    color: isToday ? C.green : wknd ? C.red + '99' : hol ? C.red : C.muted,
                    fontFamily: "ui-monospace, monospace", marginTop: isFirst ? 6 : 0,
                  }}>
                    {d.getDate()}
                  </span>
                  <span style={{ fontSize: 7, color: C.muted + '88' }}>
                    {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'][d.getDay()]}
                  </span>
                </div>
              );
            })}
          </div>
          {/* Gantt bars */}
          {activeTasks.map((t, i) => {
            const devIdx = developers.indexOf(t.developer);
            const color = devColors[devIdx >= 0 ? devIdx % devColors.length : 0];
            const start = parseDate(t.startDate);
            const end = parseDate(t.endDate);
            return (
              <div key={t.id} style={{ display: 'flex', height: rowH, borderBottom: `1px solid ${C.border}08`, background: i % 2 ? C.surface2 + '88' : 'transparent' }}>
                {timelineDays.map((d, di) => {
                  const ds = formatDate(d);
                  const inRange = start && end && d >= start && d <= end;
                  const wknd = isWeekend(d);
                  const hol = isHoliday(d, holidays);
                  const isToday = ds === formatDate(today);
                  const isWork = inRange && !wknd && !hol;
                  const isNonWork = inRange && (wknd || hol);
                  return (
                    <div key={di} style={{
                      width: cellW, minWidth: cellW, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: isWork ? color + '33' : isNonWork ? C.surface2 : isToday ? C.green + '08' : wknd || hol ? '#0a0a12' : 'transparent',
                      borderLeft: isWork && ds === t.startDate ? `2px solid ${color}` : 'none',
                      borderRight: isWork && ds === t.endDate ? `2px solid ${color}` : 'none',
                    }}>
                      {isWork && <div style={{ width: '100%', height: 14, background: color + '66', borderRadius: ds === t.startDate ? '3px 0 0 3px' : ds === t.endDate ? '0 3px 3px 0' : 0 }} />}
                      {isNonWork && <span style={{ fontSize: 8, color: C.muted + '66' }}>·</span>}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
