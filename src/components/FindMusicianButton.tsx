'use client';

import { useBot } from './BotProvider';

// Any "Find your musician" CTA across the page opens the bot via this button.
export function FindMusicianButton({
  label = 'Find your musician',
  variant = 'primary',
  className = '',
}: {
  label?: string;
  variant?: 'primary' | 'ghost';
  className?: string;
}) {
  const { openBot } = useBot();
  return (
    <button
      type="button"
      onClick={openBot}
      className={`${variant === 'primary' ? 'btn-primary' : 'btn-ghost'} ${className}`}
    >
      {label}
    </button>
  );
}
