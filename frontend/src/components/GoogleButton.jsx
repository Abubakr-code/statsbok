import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '../i18n';
import { useAuth } from '../hooks/useAuth';
import api from '../services/api';

const ENV_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const GIS_SRC = 'https://accounts.google.com/gsi/client';
const GOOGLE_SCOPES = 'openid email profile';

function loadGis() {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.id) return resolve();
    const existing = document.querySelector(`script[src="${GIS_SRC}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', reject);
      return;
    }
    const s = document.createElement('script');
    s.src = GIS_SRC;
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

export default function GoogleButton({ onError }) {
  const t = useI18n((s) => s.t);
  const navigate = useNavigate();
  const { googleLogin } = useAuth();
  const tokenClientRef = useRef(null);
  const onErrorRef = useRef(onError);
  useEffect(() => { onErrorRef.current = onError; }, [onError]);
  const [clientId, setClientId] = useState(ENV_CLIENT_ID || '');
  const [loadingClientId, setLoadingClientId] = useState(!ENV_CLIENT_ID);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (ENV_CLIENT_ID) {
      setLoadingClientId(false);
      return;
    }
    let cancelled = false;
    api
      .get('/auth/google-client-id')
      .then((res) => {
        if (cancelled) return;
        setClientId(res?.data?.clientId || '');
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoadingClientId(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!clientId) return;
    let cancelled = false;

    loadGis()
      .then(() => {
        if (cancelled) return;
        const oauth = window.google?.accounts?.oauth2;
        if (!oauth) throw new Error('Google OAuth is unavailable');

        tokenClientRef.current = oauth.initTokenClient({
          client_id: clientId,
          scope: GOOGLE_SCOPES,
          callback: async (tokenResponse) => {
            if (tokenResponse?.error) {
              onErrorRef.current?.(tokenResponse.error_description || tokenResponse.error || 'Google login failed');
              return;
            }
            try {
              await googleLogin({ accessToken: tokenResponse.access_token });
              navigate('/', { replace: true });
            } catch (err) {
              onErrorRef.current?.(err.message || 'Google login failed');
            }
          }
        });
        setReady(true);
      })
      .catch(() => onErrorRef.current?.('Could not load Google Sign-In'));

    return () => {
      cancelled = true;
      tokenClientRef.current = null;
      setReady(false);
    };
  }, [clientId, googleLogin, navigate]);

  function handleGoogleLogin() {
    if (!clientId) {
      onErrorRef.current?.('Google Client ID is not configured');
      return;
    }
    if (!tokenClientRef.current) {
      onErrorRef.current?.('Google Sign-In is not ready yet');
      return;
    }
    // Force account chooser every time so users can switch Gmail accounts.
    tokenClientRef.current.requestAccessToken({ prompt: 'select_account' });
  }

  if (!clientId) {
    return (
      <button type="button" disabled className="btn-ghost w-full opacity-60">
        {loadingClientId ? t('common.loading') : t('auth.google')}
      </button>
    );
  }

  return (
    <button type="button" onClick={handleGoogleLogin} disabled={!ready} className="btn-ghost w-full disabled:opacity-60">
      {ready ? t('auth.google') : t('common.loading')}
    </button>
  );
}
