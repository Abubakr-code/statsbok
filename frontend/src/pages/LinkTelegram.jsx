import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../hooks/useAuth';
import { useI18n } from '../i18n';

const TEXT = {
  uz: {
    title: 'Telegram akkauntini bog‘lash',
    loading: 'Bog‘lanmoqda...',
    success: '✅ Akkaunt muvaffaqiyatli bog‘landi! Endi botdan kitoblarni shaxsiy kutubxonangizga qo‘shishingiz mumkin.',
    nocode: 'Kod topilmadi. Botda /link buyrug‘ini qayta bosing.',
    needlogin: 'Avval saytga kiring, so‘ng botdagi bog‘lash havolasini qayta oching.',
    error: 'Bog‘lab bo‘lmadi: kod noto‘g‘ri yoki muddati o‘tgan. Botda /link ni qayta bosing.',
    toLogin: 'Saytga kirish',
    toLibrary: 'Kutubxonaga o‘tish'
  },
  ru: {
    title: 'Привязка Telegram-аккаунта',
    loading: 'Привязываем...',
    success: '✅ Аккаунт успешно привязан! Теперь можно добавлять книги из бота в личную библиотеку.',
    nocode: 'Код не найден. Нажмите /link в боте ещё раз.',
    needlogin: 'Сначала войдите на сайт, затем снова откройте ссылку привязки из бота.',
    error: 'Не удалось привязать: код неверный или истёк. Нажмите /link в боте снова.',
    toLogin: 'Войти',
    toLibrary: 'В библиотеку'
  },
  en: {
    title: 'Link Telegram account',
    loading: 'Linking...',
    success: '✅ Account linked! You can now add books from the bot to your personal library.',
    nocode: 'No code found. Tap /link in the bot again.',
    needlogin: 'Please log in first, then reopen the link from the bot.',
    error: 'Could not link: the code is invalid or expired. Tap /link in the bot again.',
    toLogin: 'Log in',
    toLibrary: 'Go to library'
  }
};

export default function LinkTelegram() {
  const [params] = useSearchParams();
  const code = (params.get('code') || '').trim();
  const { isAuthenticated, checked } = useAuth();
  const lang = useI18n((s) => s.lang);
  const tx = TEXT[lang] || TEXT.uz;
  const [status, setStatus] = useState('loading'); // loading|success|error|nocode|needlogin
  const [detail, setDetail] = useState('');

  useEffect(() => {
    if (!checked) return;
    if (!code) { setStatus('nocode'); return; }
    if (!isAuthenticated) { setStatus('needlogin'); return; }
    setStatus('loading');
    api.post('/telegram/link/confirm', { code })
      .then(() => setStatus('success'))
      .catch((e) => { setDetail(e.message || ''); setStatus('error'); });
  }, [checked, isAuthenticated, code]);

  return (
    <div className="mx-auto flex max-w-md flex-col px-4 py-20 text-center">
      <div className="mb-6 text-5xl">🔗</div>
      <h1 className="mb-4 font-display text-2xl text-parchment">{tx.title}</h1>

      {status === 'loading' && <p className="text-parchment-dim">{tx.loading}</p>}

      {status === 'success' && (
        <>
          <p className="mb-6 text-parchment-dim">{tx.success}</p>
          <Link to="/library" className="btn-primary mx-auto px-6 py-2.5">{tx.toLibrary}</Link>
        </>
      )}

      {status === 'needlogin' && (
        <>
          <p className="mb-6 text-parchment-dim">{tx.needlogin}</p>
          <Link to="/login" className="btn-primary mx-auto px-6 py-2.5">{tx.toLogin}</Link>
        </>
      )}

      {status === 'nocode' && <p className="text-parchment-dim">{tx.nocode}</p>}

      {status === 'error' && (
        <>
          <p className="mb-2 text-red-400">{tx.error}</p>
          {detail && <p className="text-xs text-parchment-faint">{detail}</p>}
        </>
      )}
    </div>
  );
}
