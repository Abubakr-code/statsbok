import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useI18n, LANGS, LANG_LABELS } from '../i18n';
import { useAuth } from '../hooks/useAuth';
import { useAuthStore } from '../store/authStore';
import { useThemeStore } from '../store/themeStore';
import { useSavedQuotes } from '../hooks/useSavedQuotes';
import api from '../services/api';
import Avatar from '../components/Avatar';
import PremiumBadge from '../components/PremiumBadge';

// Read an image file and downscale it to a small square JPEG data URL.
function fileToAvatarDataUrl(file, size = 256) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        const min = Math.min(img.width, img.height);
        const sx = (img.width - min) / 2;
        const sy = (img.height - min) / 2;
        ctx.drawImage(img, sx, sy, min, min, 0, 0, size, size);
        resolve(canvas.toDataURL('image/jpeg', 0.82));
      };
      img.onerror = reject;
      img.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function Profile() {
  const t = useI18n((s) => s.t);
  const setLang = useI18n((s) => s.setLang);
  const { user, isPremium } = useAuth();
  const setUser = useAuthStore((s) => s.setUser);
  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);
  const { savedCount, load } = useSavedQuotes();
  const fileRef = useRef(null);

  const [name, setName] = useState(user?.name || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [language, setLanguage] = useState(user?.language || 'uz');
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl || null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(null);

  const [pwd, setPwd] = useState({ currentPassword: '', newPassword: '' });
  const [pwdMsg, setPwdMsg] = useState(null);
  const [pwdErr, setPwdErr] = useState(null);
  const [pwdBusy, setPwdBusy] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleAvatarPick(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    try {
      const dataUrl = await fileToAvatarDataUrl(file);
      setAvatarUrl(dataUrl);
    } catch {
      setError(t('common.error'));
    }
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const { data } = await api.patch('/users/profile', { name, language, bio, avatarUrl });
      setUser(data.user);
      setLang(language);
      setSaved(true);
    } catch (err) {
      setError(err.message || t('common.error'));
    } finally {
      setSaving(false);
    }
  }

  async function handlePasswordChange(e) {
    e.preventDefault();
    setPwdBusy(true);
    setPwdMsg(null);
    setPwdErr(null);
    try {
      await api.post('/users/change-password', pwd);
      setPwd({ currentPassword: '', newPassword: '' });
      setPwdMsg(t('profile.password.changed'));
    } catch (err) {
      setPwdErr(err.message || t('common.error'));
    } finally {
      setPwdBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="mb-8 text-3xl text-parchment">{t('profile.title')}</h1>

      {/* Identity card with avatar */}
      <form onSubmit={handleSave} className="card mb-6 space-y-5">
        <div className="flex items-center gap-5">
          <Avatar user={{ ...user, avatarUrl }} size={84} />
          <div className="flex flex-col gap-2">
            <input ref={fileRef} type="file" accept="image/*" onChange={handleAvatarPick} className="hidden" />
            <button type="button" onClick={() => fileRef.current?.click()} className="btn-ghost px-4 py-2 text-sm">
              {t('profile.avatar.change')}
            </button>
            {avatarUrl && (
              <button
                type="button"
                onClick={() => setAvatarUrl(null)}
                className="text-xs text-parchment-faint hover:text-red-400"
              >
                {t('profile.avatar.remove')}
              </button>
            )}
          </div>
          <div className="ml-auto">
            {isPremium ? <PremiumBadge /> : <span className="text-sm text-parchment-dim">{t('premium.free')}</span>}
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm text-parchment-dim">{t('profile.name')}</label>
          <input value={name} onChange={(e) => setName(e.target.value)} className="input" />
        </div>

        <div>
          <label className="mb-1 block text-sm text-parchment-dim">{t('profile.bio')}</label>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value.slice(0, 300))}
            rows={3}
            placeholder={t('profile.bio.placeholder')}
            className="input resize-none"
          />
          <p className="mt-1 text-right text-xs text-parchment-faint">{bio.length}/300</p>
        </div>

        <div className="text-sm text-parchment-dim">
          {user?.email && <span className="mr-3">{t('profile.email')}: {user.email}</span>}
          {user?.phone && <span>{t('profile.phone')}: +{user.phone}</span>}
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}
        {saved && <p className="text-sm text-amber">{t('profile.saved')}</p>}

        <button type="submit" disabled={saving} className="btn-primary">
          {saving ? t('common.loading') : t('profile.save')}
        </button>
      </form>

      {/* Settings: language + theme */}
      <div className="card mb-6 space-y-5">
        <h2 className="text-lg text-parchment">{t('profile.settings')}</h2>
        <div>
          <label className="mb-1 block text-sm text-parchment-dim">{t('profile.language')}</label>
          <select value={language} onChange={(e) => setLanguage(e.target.value)} className="input">
            {LANGS.map((l) => (
              <option key={l} value={l}>
                {LANG_LABELS[l]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-2 block text-sm text-parchment-dim">{t('profile.theme')}</label>
          <div className="flex gap-2">
            {['dark', 'light'].map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setTheme(mode)}
                className={`flex-1 rounded-lg border px-4 py-2.5 text-sm transition-colors ${
                  theme === mode
                    ? 'border-amber bg-amber/15 text-amber'
                    : 'border-ink-600 text-parchment-dim hover:text-parchment'
                }`}
              >
                {t(`profile.theme.${mode}`)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Archive management */}
      <div className="card mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-lg text-parchment">{t('profile.archive.title')}</h2>
          <p className="text-sm text-parchment-dim">{t('profile.archive.count', { n: savedCount })}</p>
        </div>
        <Link to="/archive" className="btn-ghost px-4 py-2 text-sm">
          {t('profile.archive.open')}
        </Link>
      </div>

      {/* Password change */}
      <form onSubmit={handlePasswordChange} className="card space-y-4">
        <h2 className="text-lg text-parchment">{t('profile.password')}</h2>
        <div>
          <label className="mb-1 block text-sm text-parchment-dim">{t('profile.password.current')}</label>
          <div className="relative">
            <input
              type={showCurrentPassword ? 'text' : 'password'}
              required
              autoComplete="current-password"
              value={pwd.currentPassword}
              onChange={(e) => setPwd({ ...pwd, currentPassword: e.target.value })}
              className="input pr-12"
            />
            <button
              type="button"
              onClick={() => setShowCurrentPassword((v) => !v)}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-2 text-parchment-faint hover:bg-ink-700 hover:text-parchment"
              aria-label={showCurrentPassword ? 'Hide password' : 'Show password'}
            >
              {showCurrentPassword ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 3l18 18M10.6 10.6A3 3 0 0 0 12 16a3 3 0 0 0 2.8-2M9.9 4.2A10.9 10.9 0 0 1 12 4c5 0 9.3 3.1 11 8-0.5 1.4-1.3 2.7-2.3 3.8M6.2 6.2C4.4 7.6 3 9.6 2 12c1.7 4.9 6 8 10 8 1.6 0 3.2-.5 4.6-1.2" />
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              )}
            </button>
          </div>
        </div>
        <div>
          <label className="mb-1 block text-sm text-parchment-dim">{t('profile.password.new')}</label>
          <div className="relative">
            <input
              type={showNewPassword ? 'text' : 'password'}
              required
              minLength={6}
              autoComplete="new-password"
              value={pwd.newPassword}
              onChange={(e) => setPwd({ ...pwd, newPassword: e.target.value })}
              className="input pr-12"
            />
            <button
              type="button"
              onClick={() => setShowNewPassword((v) => !v)}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-2 text-parchment-faint hover:bg-ink-700 hover:text-parchment"
              aria-label={showNewPassword ? 'Hide password' : 'Show password'}
            >
              {showNewPassword ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 3l18 18M10.6 10.6A3 3 0 0 0 12 16a3 3 0 0 0 2.8-2M9.9 4.2A10.9 10.9 0 0 1 12 4c5 0 9.3 3.1 11 8-0.5 1.4-1.3 2.7-2.3 3.8M6.2 6.2C4.4 7.6 3 9.6 2 12c1.7 4.9 6 8 10 8 1.6 0 3.2-.5 4.6-1.2" />
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              )}
            </button>
          </div>
        </div>
        {pwdErr && <p className="text-sm text-red-400">{pwdErr}</p>}
        {pwdMsg && <p className="text-sm text-amber">{pwdMsg}</p>}
        <button type="submit" disabled={pwdBusy} className="btn-ghost">
          {pwdBusy ? t('common.loading') : t('profile.password.change')}
        </button>
      </form>
    </div>
  );
}
