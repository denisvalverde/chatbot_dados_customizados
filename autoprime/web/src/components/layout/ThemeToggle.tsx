'use client';

import { useEffect, useState } from 'react';

export function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('autoprime_theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const isDark = stored ? stored === 'dark' : prefersDark;
    setDark(isDark);
    document.documentElement.classList.toggle('dark', isDark);
  }, []);

  function toggle() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle('dark', next);
    localStorage.setItem('autoprime_theme', next ? 'dark' : 'light');
  }

  return (
    <button
      onClick={toggle}
      aria-label="Alternar tema"
      className="h-9 w-9 flex items-center justify-center rounded-lg border border-black/10 dark:border-white/10 text-graphite-600 dark:text-white/70 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
    >
      {dark ? '☀️' : '🌙'}
    </button>
  );
}
