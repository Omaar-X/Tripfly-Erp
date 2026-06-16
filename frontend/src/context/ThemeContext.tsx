import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

interface ThemeCtx { dark: boolean; toggle: () => void; }
const Ctx = createContext<ThemeCtx>(null as never);
export const useTheme = () => useContext(Ctx);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [dark, setDark] = useState(() =>
    localStorage.getItem('tf_theme') === 'dark' ||
    (!localStorage.getItem('tf_theme') && window.matchMedia('(prefers-color-scheme: dark)').matches));

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    localStorage.setItem('tf_theme', dark ? 'dark' : 'light');
  }, [dark]);

  return <Ctx.Provider value={{ dark, toggle: () => setDark(d => !d) }}>{children}</Ctx.Provider>;
}
