import type { CSSProperties } from 'react';

// Dev colors are fixed identity colors (not theme-dependent)
export const devColors = [
  '#4a9eff', '#3fb950', '#d29922', '#bc8cff', '#39d2c0', '#f778ba', '#f85149',
  '#ffa657', '#79c0ff', '#7ee787',
];

export function btnStyle(color: string = '#4a9eff'): CSSProperties {
  return {
    background: color + '22', border: `1px solid ${color}44`, borderRadius: 6,
    color, padding: '7px 16px', fontSize: 13, cursor: 'pointer', fontWeight: 600,
    fontFamily: 'ui-monospace, monospace', transition: 'all .15s',
  };
}

export function btnPill(color: string): CSSProperties {
  return {
    background: color + '22', border: `1px solid ${color}33`, borderRadius: 4,
    color, width: 26, height: 24, cursor: 'pointer', fontSize: 12, fontWeight: 700,
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  };
}
