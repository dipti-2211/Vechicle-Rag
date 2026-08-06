import { useContext } from 'react';
import { ThemeContext } from './themeContextObject';

/**
 * Hook to access the current theme and toggle function.
 * Must be used inside a ThemeProvider.
 */
export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
