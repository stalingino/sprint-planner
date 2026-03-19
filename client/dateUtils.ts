import type { Holiday } from './types';

export function parseDate(s: string | null | undefined): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

export function formatDate(d: Date | null): string {
  if (!d) return '';
  return d.toISOString().split('T')[0];
}

export function formatDisplay(d: Date | null): string {
  if (!d) return '—';
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' });
}

export function isWeekend(d: Date): boolean {
  const day = d.getDay();
  return day === 0 || day === 6;
}

export function isHoliday(d: Date, holidays: Holiday[]): boolean {
  const ds = formatDate(d);
  return holidays.some(h => h.date === ds);
}

export function isWorkingDay(d: Date, holidays: Holiday[]): boolean {
  return !isWeekend(d) && !isHoliday(d, holidays);
}

export function eachDay(start: Date, end: Date): Date[] {
  const days: Date[] = [];
  const d = new Date(start);
  while (d <= end) {
    days.push(new Date(d));
    d.setDate(d.getDate() + 1);
  }
  return days;
}
