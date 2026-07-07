import { useEffect, useState } from 'react';
import { Link, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useI18n, LANGS, LANG_LABELS } from '../i18n';
import { useAuth } from '../hooks/useAuth';
import { useThemeStore } from '../store/themeStore';
import Avatar from './Avatar';

function ThemeToggle() {
  const theme = useThemeStore((s) => s.theme);
  const toggle = useThemeStore((s) => s.toggle);
  return (
    <button
      onClick={toggle}
      aria-label="Theme"
      className="flex h-9 w-9 items-center justify-center rounded-lg border border-ink-600 text-parchment-dim transition-colors hover:text-amber"
    >
      {theme === 'light' ? (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
        </svg>
      ) : (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M19 5l-1.5 1.5M6.5 17.5L5 19" />
        </svg>
      )}
    </button>
  );
}

function LangSwitcher() {
  const lang = useI18n((s) => s.lang);
  const setLang = useI18n((s) => s.setLang);
  return (
    <div className="flex items-center rounded-lg border border-ink-600 p-0.5 text-xs">
      {LANGS.map((l) => (
        <button
          key={l}
          onClick={() => setLang(l)}
          className={`rounded px-2 py-1 uppercase transition-colors ${
            lang === l ? 'bg-amber text-ink' : 'text-parchment-dim hover:text-parchment'
          }`}
          title={LANG_LABELS[l]}
        >
          {l}
        </button>
      ))}
    </div>
  );
}

export default function Navbar() {
  const t = useI18n((s) => s.t);
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, logout, user } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  // Close the mobile menu whenever the route changes.
  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  // Lock body scroll while the mobile menu is open.
  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [menuOpen]);

  const linkClass = ({ isActive }) =>
    `text-sm transition-colors ${isActive ? 'text-amber' : 'text-parchment-dim hover:text-parchment'}`;

  const mobileLinkClass = ({ isActive }) =>
    `block rounded-lg px-3 py-3 text-base transition-colors ${
      isActive ? 'bg-amber/10 text-amber' : 'text-parchment hover:bg-ink-700'
    }`;

  async function handleLogout() {
    await logout();
    navigate('/');
  }

  return (
    <header className="sticky top-0 z-40 border-b border-ink-600 bg-ink/80 backdrop-blur">
      <nav className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <Link to="/" className="flex items-center gap-2" onClick={() => setMenuOpen(false)}>
          <span className="font-display text-xl font-semibold text-parchment sm:text-2xl">StatBooks</span>
          <span className="text-amber">·</span>
        </Link>

        {/* Desktop navigation */}
        <div className="hidden items-center gap-4 md:flex">
          <NavLink to="/" className={linkClass} end>
            {t('nav.home')}
          </NavLink>
          {isAuthenticated && (
            <NavLink to="/archive" className={linkClass}>
              {t('nav.archive')}
            </NavLink>
          )}
          {isAuthenticated && (
            <NavLink to="/blogger" className={linkClass}>
              Blogger
            </NavLink>
          )}
          {isAuthenticated && (
            <NavLink to="/library" className={linkClass}>
              {t('nav.library')}
            </NavLink>
          )}
          <LangSwitcher />
          <ThemeToggle />

          {isAuthenticated ? (
            <div className="flex items-center gap-3">
              <Link
                to="/profile"
                className="flex items-center gap-2 text-sm text-parchment-dim transition-colors hover:text-amber"
                title={user?.name || user?.email || user?.phone}
              >
                <Avatar user={user} size={32} />
                <span className="hidden lg:inline">{user?.name || user?.email || user?.phone}</span>
              </Link>
              <button onClick={handleLogout} className="btn-ghost px-3 py-1.5 text-sm">
                {t('nav.logout')}
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link to="/login" className="btn-ghost px-3 py-1.5 text-sm">
                {t('nav.login')}
              </Link>
              <Link to="/register" className="btn-primary px-3 py-1.5 text-sm">
                {t('nav.register')}
              </Link>
            </div>
          )}
        </div>

        {/* Mobile: avatar + hamburger */}
        <div className="flex items-center gap-2 md:hidden">
          {isAuthenticated && (
            <Link to="/profile" aria-label={t('nav.profile')} onClick={() => setMenuOpen(false)}>
              <Avatar user={user} size={32} />
            </Link>
          )}
          <button
            onClick={() => setMenuOpen((o) => !o)}
            aria-label="Menu"
            aria-expanded={menuOpen}
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-ink-600 text-parchment transition-colors hover:text-amber"
          >
            {menuOpen ? (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            ) : (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 6h18M3 12h18M3 18h18" />
              </svg>
            )}
          </button>
        </div>
      </nav>

      {/* Mobile dropdown menu */}
      {menuOpen && (
        <>
          <div
            className="fixed inset-0 top-[57px] z-30 bg-black/40 md:hidden"
            onClick={() => setMenuOpen(false)}
          />
          <div className="absolute inset-x-0 top-full z-40 max-h-[calc(100vh-57px)] overflow-y-auto border-b border-ink-600 bg-ink-800 px-4 py-3 shadow-xl md:hidden">
            <div className="flex flex-col gap-1">
              <NavLink to="/" className={mobileLinkClass} end>
                {t('nav.home')}
              </NavLink>
              {isAuthenticated && (
                <NavLink to="/archive" className={mobileLinkClass}>
                  {t('nav.archive')}
                </NavLink>
              )}
              {isAuthenticated && (
                <NavLink to="/blogger" className={mobileLinkClass}>
                  Blogger
                </NavLink>
              )}
              {isAuthenticated && (
                <NavLink to="/library" className={mobileLinkClass}>
                  {t('nav.library')}
                </NavLink>
              )}
              {isAuthenticated && (
                <NavLink to="/profile" className={mobileLinkClass}>
                  {t('nav.profile')}
                </NavLink>
              )}
            </div>

            <div className="my-3 flex items-center justify-between border-t border-ink-600 pt-3">
              <LangSwitcher />
              <ThemeToggle />
            </div>

            {isAuthenticated ? (
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-sm text-parchment-dim">
                  <span className="truncate">{user?.name || user?.email || user?.phone}</span>
                </div>
                <button onClick={handleLogout} className="btn-ghost px-3 py-2 text-sm">
                  {t('nav.logout')}
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <Link to="/login" className="btn-ghost justify-center px-3 py-2.5 text-sm">
                  {t('nav.login')}
                </Link>
                <Link to="/register" className="btn-primary justify-center px-3 py-2.5 text-sm">
                  {t('nav.register')}
                </Link>
              </div>
            )}
          </div>
        </>
      )}
    </header>
  );
}
