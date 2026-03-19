import type { CSSProperties } from 'react';

export const C = {
  bg: '#0d1117', surface: '#161b22', surface2: '#1c2333', border: '#30363d',
  text: '#e6edf3', muted: '#7d8590', blue: '#4a9eff', green: '#3fb950',
  orange: '#d29922', red: '#f85149', purple: '#bc8cff', teal: '#39d2c0',
  pink: '#f778ba', input: '#0d1117',
} as const;

export const devColors = [
  C.blue, C.green, C.orange, C.purple, C.teal, C.pink, C.red,
  '#ffa657', '#79c0ff', '#7ee787',
];

export const inputStyle: CSSProperties = {
  background: C.input, border: `1px solid ${C.border}`, borderRadius: 5,
  color: C.text, padding: '6px 10px', fontSize: 13, outline: 'none', width: '100%',
  fontFamily: "ui-monospace, monospace",
  boxSizing: 'border-box',
};

export function btnStyle(color: string = C.blue): CSSProperties {
  return {
    background: color + '22', border: `1px solid ${color}44`, borderRadius: 6,
    color, padding: '6px 14px', fontSize: 12, cursor: 'pointer', fontWeight: 600,
    fontFamily: "ui-monospace, monospace", transition: 'all .15s',
  };
}

export function btnPill(color: string): CSSProperties {
  return {
    background: color + '22', border: `1px solid ${color}33`, borderRadius: 4,
    color, width: 24, height: 22, cursor: 'pointer', fontSize: 11, fontWeight: 700,
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  };
}
