import { useToastStore } from '../store/toastStore';

export default function Toast() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);

  if (!toasts.length) return null;

  return (
    <div className="fixed bottom-6 left-1/2 z-[9999] flex -translate-x-1/2 flex-col items-center gap-2 pointer-events-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          onClick={() => dismiss(toast.id)}
          className={`pointer-events-auto flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium shadow-lg transition-all animate-fade-in cursor-pointer select-none
            ${toast.type === 'error' ? 'bg-red-900/90 text-red-100 border border-red-700' : ''}
            ${toast.type === 'success' ? 'bg-ink-700 text-parchment border border-amber/30' : ''}
            ${toast.type === 'info' ? 'bg-ink-700 text-parchment-dim border border-ink-500' : ''}
          `}
        >
          {toast.type === 'success' && (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-amber flex-shrink-0">
              <path d="M20 6 9 17l-5-5" />
            </svg>
          )}
          {toast.type === 'error' && (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-red-400 flex-shrink-0">
              <circle cx="12" cy="12" r="10" /><path d="M12 8v4m0 4h.01" />
            </svg>
          )}
          {toast.type === 'info' && (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-amber/60 flex-shrink-0">
              <circle cx="12" cy="12" r="10" /><path d="M12 16v-4m0-4h.01" />
            </svg>
          )}
          {toast.message}
        </div>
      ))}
    </div>
  );
}
