import { create } from 'zustand';
import { persist } from 'zustand/middleware';

function apply(theme) {
  if (typeof document === 'undefined') return;
  document.documentElement.classList.toggle('light', theme === 'light');
}

/**
 * Theme state (dark | light), persisted to localStorage under
 * "statbooks-theme". A small script in index.html applies the saved theme
 * before React mounts to avoid a flash.
 */
export const useThemeStore = create(
  persist(
    (set, get) => ({
      theme: 'dark',
      setTheme: (theme) => {
        apply(theme);
        set({ theme });
      },
      toggle: () => {
        const next = get().theme === 'light' ? 'dark' : 'light';
        apply(next);
        set({ theme: next });
      },
      // Re-apply on load (in case the inline script didn't run).
      sync: () => apply(get().theme)
    }),
    { name: 'statbooks-theme' }
  )
);
