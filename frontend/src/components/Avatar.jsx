/**
 * Round avatar. Shows the user's photo if set, otherwise their initials on a
 * warm amber background.
 */
function initials(user) {
  const base = user?.name || user?.email || user?.phone || '?';
  const parts = String(base).trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return String(base).slice(0, 2).toUpperCase();
}

export default function Avatar({ user, size = 40, className = '' }) {
  const dim = { width: size, height: size };
  if (user?.avatarUrl) {
    return (
      <img
        src={user.avatarUrl}
        alt={user?.name || 'avatar'}
        style={dim}
        className={`rounded-full object-cover ${className}`}
      />
    );
  }
  return (
    <span
      style={{ ...dim, fontSize: size * 0.4 }}
      className={`flex items-center justify-center rounded-full bg-amber/20 font-display font-semibold text-amber ${className}`}
    >
      {initials(user)}
    </span>
  );
}
