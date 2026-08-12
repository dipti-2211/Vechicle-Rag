import { useEffect } from 'react';
import { ThemeContext } from './themeContextObject';

export function ThemeProvider({ children }) {
  // Always dark mode — light mode removed
  const theme = 'dark';

  useEffect(() => {
    window.document.documentElement.classList.add('dark');
    localStorage.setItem('theme', 'dark');
  }, []);

  // No-op: kept so any code importing toggleTheme doesn't break
  const toggleTheme = () => {};

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
