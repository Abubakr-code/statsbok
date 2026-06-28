export default function PremiumBadge({ className = '' }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full bg-amber/15 px-2.5 py-0.5 text-xs font-medium text-amber ${className}`}
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M12 2l2.9 6.3L22 9.2l-5 4.9 1.2 6.9L12 17.8 5.8 21l1.2-6.9-5-4.9 7.1-.9z" />
      </svg>
      Premium
    </span>
  );
}
