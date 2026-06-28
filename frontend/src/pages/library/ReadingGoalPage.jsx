import { useEffect, useState } from 'react';
import { useI18n } from '../../i18n';
import { useLibraryStore } from '../../store/libraryStore';
import { useToastStore } from '../../store/toastStore';
import { useAuth } from '../../hooks/useAuth';
import SEO from '../../components/SEO';
import GoalRing from '../../components/library/GoalRing';
import ReadingCalendar from '../../components/library/ReadingCalendar';
import { useNavigate } from 'react-router-dom';

export default function ReadingGoalPage() {
  const { t } = useI18n((s) => s);
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const showToast = useToastStore((s) => s.show);
  const { goal, stats, fetchGoal, fetchStats, setGoal } = useLibraryStore();

  const currentYear = new Date().getFullYear();
  const [target, setTarget] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) { navigate('/login'); return; }
    fetchGoal(currentYear);
    fetchStats();
  }, [isAuthenticated]);

  async function handleSave() {
    if (!target || parseInt(target) < 1) { showToast('Maqsad kiritilmagan', 'error'); return; }
    setSaving(true);
    try {
      await setGoal({ year: currentYear, targetBooks: parseInt(target) });
      showToast(t('library.goal.saved'), 'success');
    } catch { showToast(t('toast.error'), 'error'); }
    finally { setSaving(false); }
  }

  const goalData = goal?.goal;
  const actualFinished = goal?.actualFinished || 0;
  const pct = goalData ? Math.round((actualFinished / goalData.targetBooks) * 100) : 0;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <SEO title={t('library.goal.title')} />
      <h1 className="text-3xl font-display text-parchment mb-8">{currentYear} {t('library.goal.title')}</h1>

      {goalData ? (
        <div className="card mb-8 flex flex-col items-center gap-6 py-8">
          <GoalRing current={actualFinished} target={goalData.targetBooks} size={120} />
          <div className="text-center">
            <p className="text-lg text-parchment">
              {actualFinished}/{goalData.targetBooks} {t('library.goal.books')}
            </p>
            <p className="text-sm text-parchment-faint mt-1">{pct}% bajarildi</p>
            {actualFinished >= goalData.targetBooks && (
              <p className="text-amber font-medium mt-3">{t('library.goal.achieved')}</p>
            )}
          </div>
          <div className="w-full max-w-xs">
            <label className="text-xs text-parchment-faint mb-1 block">Maqsadni o'zgartirish</label>
            <div className="flex gap-2">
              <input type="number" value={target} onChange={(e) => setTarget(e.target.value)}
                placeholder={String(goalData.targetBooks)}
                className="flex-1 rounded-lg border border-ink-600 bg-ink-800 px-3 py-2 text-sm text-parchment outline-none focus:border-amber" />
              <button onClick={handleSave} disabled={saving} className="btn-primary px-4 py-2 text-sm">
                {saving ? '...' : 'Saqlash'}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="card mb-8 text-center py-10">
          <p className="text-4xl mb-4">🎯</p>
          <p className="text-parchment mb-6">{t('library.goal.noGoal')}</p>
          <div className="flex items-center gap-3 justify-center max-w-xs mx-auto">
            <input type="number" value={target} onChange={(e) => setTarget(e.target.value)}
              placeholder="20" min="1"
              className="flex-1 rounded-lg border border-ink-600 bg-ink-800 px-3 py-2 text-sm text-parchment outline-none focus:border-amber" />
            <span className="text-sm text-parchment-faint whitespace-nowrap">{t('library.goal.books')}</span>
            <button onClick={handleSave} disabled={saving} className="btn-primary px-4 py-2 text-sm whitespace-nowrap">
              {saving ? '...' : t('library.goal.set')}
            </button>
          </div>
        </div>
      )}

      {/* Reading Calendar */}
      <div className="card">
        <h2 className="text-lg font-display text-parchment mb-4">O'qish taqvimi</h2>
        <ReadingCalendar />
      </div>

      {stats && (
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
          <div className="card text-center py-4">
            <p className="text-2xl font-display text-amber">{stats.currentStreak}</p>
            <p className="text-xs text-parchment-faint">{t('library.stats.streak')}</p>
          </div>
          <div className="card text-center py-4">
            <p className="text-2xl font-display text-amber">{stats.longestStreak}</p>
            <p className="text-xs text-parchment-faint">Eng uzun seriya</p>
          </div>
          <div className="card text-center py-4">
            <p className="text-2xl font-display text-amber">{Math.round((stats.totalMinutes||0)/60)}</p>
            <p className="text-xs text-parchment-faint">{t('library.stats.totalHours')}</p>
          </div>
        </div>
      )}
    </div>
  );
}
