// ─────────────────────────────────────────────────────────────────
// ThemeProvider
//
// Applies "theme-light" / "theme-dark" (and optionally "accent-cool")
// classes on <html>. Persists choice to localStorage. The inline
// script in index.html runs before React mounts so the theme class is
// on <html> on first paint (prevents FOUC).
//
// Usage:
//   <ThemeProvider>...</ThemeProvider>
//   const { mode, accent, setMode, setAccent } = useTheme();
// ─────────────────────────────────────────────────────────────────
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

type Mode = 'light' | 'dark';
type Accent = 'warm' | 'cool';

type ThemeContextValue = {
  mode: Mode;
  accent: Accent;
  setMode: (m: Mode) => void;
  setAccent: (a: Accent) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<Mode>('light');
  const [accent, setAccentState] = useState<Accent>('warm');

  // Hydrate from localStorage / system preference on first client render.
  // The bootstrap script in index.html already set the matching classes on
  // <html> pre-mount, so this just syncs React state to what's on the DOM.
  useEffect(() => {
    const saved = localStorage.getItem('theme-mode') as Mode | null;
    const savedAccent = localStorage.getItem('theme-accent') as Accent | null;
    const prefers = window.matchMedia('(prefers-color-scheme: dark)').matches;
    /* eslint-disable react-hooks/set-state-in-effect */
    setModeState(saved ?? (prefers ? 'dark' : 'light'));
    setAccentState(savedAccent ?? 'warm');
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  // Apply classes to <html> whenever mode/accent change.
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('theme-light', 'theme-dark');
    root.classList.add(`theme-${mode}`);
    root.classList.toggle('accent-cool', accent === 'cool');
    root.style.colorScheme = mode;
  }, [mode, accent]);

  const setMode = (m: Mode) => {
    setModeState(m);
    localStorage.setItem('theme-mode', m);
  };
  const setAccent = (a: Accent) => {
    setAccentState(a);
    localStorage.setItem('theme-accent', a);
  };

  return (
    <ThemeContext.Provider value={{ mode, accent, setMode, setAccent }}>
      {children}
    </ThemeContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>');
  return ctx;
}

// Mirror of the inline bootstrap script in index.html — kept here as
// the source of truth so future Next.js/SSR ports have a drop-in.
export const themeBootstrapScript = `
(function() {
  try {
    var m = localStorage.getItem('theme-mode');
    var a = localStorage.getItem('theme-accent');
    if (!m) m = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    document.documentElement.classList.add('theme-' + m);
    if (a === 'cool') document.documentElement.classList.add('accent-cool');
    document.documentElement.style.colorScheme = m;
  } catch (e) {}
})();
`;

// Drop-in toggle component from the handoff — kept available even though
// AppLayout uses its own toggle UI. Useful for ad-hoc placements / debug.
export function ThemeToggle() {
  const { mode, accent, setMode, setAccent } = useTheme();
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => setMode(mode === 'light' ? 'dark' : 'light')}
        className="btn sm"
        aria-label="Toggle theme"
      >
        {mode === 'light' ? '☾ Dark' : '☀ Light'}
      </button>
      <button
        onClick={() => setAccent(accent === 'warm' ? 'cool' : 'warm')}
        className="btn sm"
        aria-label="Toggle accent"
      >
        {accent === 'warm' ? 'Warm' : 'Cool'}
      </button>
    </div>
  );
}
