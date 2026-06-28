import { useEffect, useState } from 'react';
import api from '../../services/api';

function getColor(pages) {
  if (!pages) return 'bg-ink-700';
  if (pages < 20) return 'bg-emerald-900';
  if (pages < 50) return 'bg-emerald-700';
  return 'bg-emerald-500';
}

export default function ReadingCalendar() {
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(true);
  const [hoveredDay, setHoveredDay] = useState(null);

  useEffect(() => {
    api.get('/library/stats/calendar').then(({ data }) => setData(data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  // Build 52 weeks x 7 days grid (last 364 days)
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = [];
  for (let i = 363; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    days.push({ key, date: d, pages: data[key]?.pages || 0, minutes: data[key]?.minutes || 0 });
  }

  // Group by week
  const startDow = days[0].date.getDay();
  const paddedDays = [...Array(startDow).fill(null), ...days];
  const weeks = [];
  for (let i = 0; i < paddedDays.length; i += 7) weeks.push(paddedDays.slice(i, i + 7));

  const activeDays = days.filter((d) => d.pages > 0).length;

  if (loading) return <div className="skeleton h-24 w-full rounded-lg" />;

  return (
    <div>
      <div className="overflow-x-auto pb-2">
        <div className="flex gap-1" style={{ minWidth: '660px' }}>
          {weeks.map((week, wi) => (
            <div key={wi} className="flex flex-col gap-1">
              {week.map((day, di) =>
                day ? (
                  <div key={di}
                    className={`h-3 w-3 rounded-sm cursor-default transition-opacity hover:opacity-80 ${getColor(day.pages)}`}
                    onMouseEnter={() => setHoveredDay(day)}
                    onMouseLeave={() => setHoveredDay(null)}
                    title={day.pages ? `${day.key}: ${day.pages} sahifa` : day.key}
                  />
                ) : (
                  <div key={di} className="h-3 w-3" />
                )
              )}
            </div>
          ))}
        </div>
      </div>
      <div className="flex items-center justify-between mt-2 text-xs text-parchment-faint">
        <span>{activeDays} kun kitob o'qildi</span>
        {hoveredDay && hoveredDay.pages > 0 && (
          <span className="text-amber">{hoveredDay.key}: {hoveredDay.pages} sahifa, {hoveredDay.minutes} daqiqa</span>
        )}
        <div className="flex items-center gap-1">
          <span>Kam</span>
          <div className="h-3 w-3 rounded-sm bg-ink-700" />
          <div className="h-3 w-3 rounded-sm bg-emerald-900" />
          <div className="h-3 w-3 rounded-sm bg-emerald-700" />
          <div className="h-3 w-3 rounded-sm bg-emerald-500" />
          <span>Ko'p</span>
        </div>
      </div>
    </div>
  );
}
