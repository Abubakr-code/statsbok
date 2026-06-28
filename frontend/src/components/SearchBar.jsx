import { useEffect, useRef, useState } from 'react';
import { useI18n } from '../i18n';

/**
 * Large auto-growing search box. Submits on Enter (Shift+Enter inserts a
 * newline). Shows a clear button when empty.
 */
export default function SearchBar({ initialValue = '', loading = false, onSearch, autoFocus }) {
  const t = useI18n((s) => s.t);
  const [value, setValue] = useState(initialValue);
  const textareaRef = useRef(null);

  useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);

  // Auto-grow the textarea so long quotes are fully visible while typing.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 240)}px`;
  }, [value]);

  function submit(text) {
    const q = (text ?? value).trim();
    if (q && !loading) onSearch(q);
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  return (
    <div className="w-full">
      <div className="relative rounded-2xl border border-ink-600 bg-ink-800 p-2 transition-colors focus-within:border-amber">
        <div className="relative">
          <textarea
            ref={textareaRef}
            value={value}
            autoFocus={autoFocus}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={2}
            placeholder={t('home.search.placeholder')}
            className="w-full resize-none bg-transparent px-3 py-2.5 pr-10 text-base text-parchment placeholder-parchment-faint outline-none sm:px-4 sm:py-3 sm:text-lg"
          />
          {value && (
            <button
              type="button"
              onClick={() => {
                setValue('');
                textareaRef.current?.focus();
              }}
              aria-label={t('search.clear')}
              className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-full text-parchment-faint transition-colors hover:bg-ink-700 hover:text-parchment"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        <div className="flex flex-col gap-2 px-1 pb-1 pt-1 sm:flex-row sm:items-center sm:justify-end">
          <button
            type="button"
            onClick={() => submit()}
            disabled={loading || !value.trim()}
            className="btn-primary group relative w-full overflow-hidden px-6 py-3 text-base sm:w-auto"
          >
            <span
              className={`absolute inset-0 -translate-x-full bg-amber-300/40 transition-transform duration-500 ${
                loading ? 'animate-[shimmer_1.2s_linear_infinite] translate-x-0' : 'group-hover:translate-x-0'
              }`}
              aria-hidden="true"
            />
            <span className="relative flex items-center justify-center gap-2">
              {loading ? (
                <>
                  <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25" />
                    <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" />
                  </svg>
                  {t('home.search.searching')}
                </>
              ) : (
                <>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="11" cy="11" r="7" />
                    <path d="M21 21l-4.3-4.3" />
                  </svg>
                  {t('home.search.button')}
                </>
              )}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
