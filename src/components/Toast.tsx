'use client';

import { useBot } from './BotProvider';

// Subtle success toast shown after the bot closes.
export function Toast() {
  const { toast } = useBot();
  if (!toast) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-0 bottom-6 z-[60] flex justify-center px-4 animate-fade-up"
    >
      <div className="flex items-center gap-3 rounded-full border border-line bg-cream px-5 py-3 text-sm font-medium text-ink shadow-sm">
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-gold text-cream">
          <svg viewBox="0 0 20 20" className="h-3 w-3" fill="currentColor" aria-hidden>
            <path d="M16.7 5.3a1 1 0 010 1.4l-7.5 7.5a1 1 0 01-1.4 0L3.3 9.7a1 1 0 011.4-1.4l3.1 3.1 6.8-6.8a1 1 0 011.1 0z" />
          </svg>
        </span>
        {toast}
      </div>
    </div>
  );
}
