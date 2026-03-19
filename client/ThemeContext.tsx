import { createContext, useContext, useState, useEffect } from 'react';
import type { CSSProperties } from 'react';

const darkC = {
  bg: '#0d1117', surface: '#161b22', surface2: '#1c2333', border: '#30363d',
  text: '#e6edf3', muted: '#7d8590', blue: '#4a9eff', green: '#3fb950',
  orange: '#d29922', red: '#f85149', purple: '#bc8cff', teal: '#39d2c0',
  pink: '#f778ba', input: '#0d1117',
} as const;

const lightC = {
  bg: '#ffffff', surface: '#f6f8fa', surface2: '#eaeef2', border: '#d0d7de',
  text: '#24292f', muted: '#656d76', blue: '#0969da', green: '#1a7f37',
  orange: '#9a6700', red: '#cf222e', purple: '#8250df', teal: '#0550ae',
  pink: '#bf3989', input: '#ffffff',
} as const;

export type Colors = typeof darkC;

export function makeInputStyle(C: Colors): CSSProperties {
  return {
    background: C.input, border: `1px solid ${C.border}`, borderRadius: 5,
    color: C.text, padding: '7px 10px', fontSize: 14, outline: 'none', width: '100%',
    fontFamily: 'ui-monospace, monospace', boxSizing: 'border-box',
  };
}

interface ThemeValue {
  C: Colors;
  inputStyle: CSSProperties;
  theme: 'dark' | 'light';
}

const ThemeContext = createContext<ThemeValue>({
  C: darkC, inputStyle: makeInputStyle(darkC), theme: 'dark',
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<'dark' | 'light'>(() =>
    window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  );

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => setTheme(e.matches ? 'dark' : 'light');
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const C = theme === 'dark' ? darkC : lightC;
  return (
    <ThemeContext.Provider value={{ C, inputStyle: makeInputStyle(C), theme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
