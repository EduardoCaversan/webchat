import { useState, useEffect } from 'react';
export function useTheme() {
  const [theme, setTheme] = useState(() => {
    try {
      const saved = localStorage.getItem('entre-theme');
      if (saved === 'light' || saved === 'dark') return saved;
    } catch {
      /* Storage may be disabled. */
    }
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem('entre-theme', theme);
    } catch {
      /* Keep in-memory preference. */
    }
  }, [theme]);
  return { theme, toggle: () => setTheme((value) => (value === 'dark' ? 'light' : 'dark')) };
}
