export default function GoalRing({ current, target, size = 80 }) {
  const pct = target > 0 ? Math.min(current / target, 1) : 0;
  const r = (size - 10) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - pct);
  const cx = size / 2;

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={cx} cy={cx} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="8" />
        <circle cx={cx} cy={cx} r={r} fill="none" stroke="#E8A94A" strokeWidth="8"
          strokeDasharray={circ} strokeDashoffset={offset}
          strokeLinecap="round" style={{ transition: 'stroke-dashoffset 0.5s ease' }} />
        <text x={cx} y={cx} textAnchor="middle" dominantBaseline="middle"
          fill="#E8DCC8" fontSize={size * 0.2} fontWeight="bold"
          style={{ transform: `rotate(90deg)`, transformOrigin: `${cx}px ${cx}px` }}>
          {current}/{target}
        </text>
      </svg>
    </div>
  );
}
