export interface Holiday { date: string; name: string }
export interface Sprint { id: string; name: string; start: string; end: string; status: string }

export function formatDate(d: Date | null): string {
  if (!d) return '';
  return d.toISOString().split('T')[0];
}

function parseDate(s: string | null | undefined): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function isWeekend(d: Date): boolean {
  const day = d.getDay();
  return day === 0 || day === 6;
}

function isHoliday(d: Date, holidays: Holiday[]): boolean {
  const ds = formatDate(d);
  return holidays.some(h => h.date === ds);
}

function isWorkingDay(d: Date, holidays: Holiday[]): boolean {
  return !isWeekend(d) && !isHoliday(d, holidays);
}

function addWorkingDays(start: Date, days: number, holidays: Holiday[]): Date {
  const d = new Date(start);
  let count = 0;
  while (count < days) {
    if (isWorkingDay(d, holidays)) count++;
    if (count < days) d.setDate(d.getDate() + 1);
  }
  return d;
}

export function recalcDates<T extends { id: string; developer: string; effortDays: number; sprint: string }>(
  tasks: T[],
  sprints: Sprint[],
  holidays: Holiday[]
): (T & { startDate: string | null; endDate: string | null })[] {
  const devEndDates: Record<string, Date> = {};
  return tasks.map(t => {
    if (!t.developer || !t.effortDays || !t.sprint) {
      return { ...t, startDate: null, endDate: null };
    }
    const sprint = sprints.find(s => s.name === t.sprint);
    if (!sprint) return { ...t, startDate: null, endDate: null };
    const sprintStart = parseDate(sprint.start);
    if (!sprintStart) return { ...t, startDate: null, endDate: null };

    const prevEnd = devEndDates[t.developer];
    let start = new Date(sprintStart);
    if (prevEnd && prevEnd >= sprintStart) {
      start = new Date(prevEnd);
      start.setDate(start.getDate() + 1);
      while (!isWorkingDay(start, holidays)) start.setDate(start.getDate() + 1);
    } else {
      while (!isWorkingDay(start, holidays)) start.setDate(start.getDate() + 1);
    }

    const end = addWorkingDays(start, t.effortDays, holidays);
    devEndDates[t.developer] = end;
    return { ...t, startDate: formatDate(start), endDate: formatDate(end) };
  });
}
