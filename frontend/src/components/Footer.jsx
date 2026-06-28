import { Link } from 'react-router-dom';
import { useI18n } from '../i18n';

const TELEGRAM_CHANNEL = 'https://t.me/statsbooks';
const TELEGRAM_ADMIN   = 'https://t.me/statbooks_admin';
const INSTAGRAM        = 'https://instagram.com/statbooks_uz';

export default function Footer() {
  const t = useI18n((s) => s.t);
  const year = new Date().getFullYear();

  return (
    <footer className="mt-20 border-t border-ink-600">
      <div className="mx-auto max-w-6xl px-4 py-12">
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-4">
          {/* Brand */}
          <div className="lg:col-span-2">
            <Link to="/" className="inline-flex items-center gap-2 mb-3">
              <span className="font-display text-2xl text-parchment">StatBooks</span>
            </Link>
            <p className="text-sm text-parchment-faint leading-relaxed max-w-xs">
              {t('footer.tagline')} {t('footer.desc')}
            </p>
            <div className="flex gap-3 mt-5">
              <a href={TELEGRAM_CHANNEL} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 rounded-lg border border-ink-600 px-3 py-2 text-xs text-parchment-dim hover:border-amber/40 hover:text-parchment transition-colors">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 8.247l-1.97 9.289c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12l-6.871 4.326-2.962-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.833.932z"/>
                </svg>
                Telegram
              </a>
              <a href={INSTAGRAM} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 rounded-lg border border-ink-600 px-3 py-2 text-xs text-parchment-dim hover:border-amber/40 hover:text-parchment transition-colors">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <rect x="2" y="2" width="20" height="20" rx="5" /><circle cx="12" cy="12" r="5" /><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/>
                </svg>
                Instagram
              </a>
            </div>
          </div>

          {/* Pages */}
          <div>
            <h3 className="mb-4 text-xs font-semibold uppercase tracking-widest text-parchment-faint">{t('footer.nav')}</h3>
            <ul className="space-y-2.5 text-sm text-parchment-dim">
              <li><Link to="/" className="hover:text-parchment transition-colors">{t('nav.home')}</Link></li>
              <li><Link to="/search" className="hover:text-parchment transition-colors">{t('nav.archive').replace('Mening a', 'A').replace('My A','A').replace('Мой а','А')}</Link></li>
              <li><Link to="/bloggers" className="hover:text-parchment transition-colors">{t('footer.bloggers')}</Link></li>
              <li><Link to="/premium" className="hover:text-parchment transition-colors">{t('nav.premium')}</Link></li>
              <li><Link to="/archive" className="hover:text-parchment transition-colors">{t('nav.archive')}</Link></li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3 className="mb-4 text-xs font-semibold uppercase tracking-widest text-parchment-faint">{t('footer.contact')}</h3>
            <ul className="space-y-2.5 text-sm text-parchment-dim">
              <li>
                <a href={TELEGRAM_ADMIN} target="_blank" rel="noopener noreferrer" className="hover:text-parchment transition-colors">
                  {t('footer.contact.admin')}
                </a>
              </li>
              <li>
                <a href={TELEGRAM_CHANNEL} target="_blank" rel="noopener noreferrer" className="hover:text-parchment transition-colors">
                  {t('footer.channel')}
                </a>
              </li>
              <li>
                <Link to="/blogger" className="hover:text-parchment transition-colors">
                  {t('footer.bloggerPanel')}
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 border-t border-ink-700 pt-6 flex flex-col items-center justify-between gap-2 text-xs text-parchment-faint sm:flex-row">
          <span>© {year} StatBooks. {t('footer.rights')}</span>
          <span className="opacity-60">{t('footer.made')}</span>
        </div>
      </div>
    </footer>
  );
}
