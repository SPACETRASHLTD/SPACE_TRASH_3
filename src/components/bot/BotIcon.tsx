// Warm, abstract mark for the assistant — a soft sound-wave bloom, not a robot.
export function BotIcon({ className = '' }: { className?: string }) {
  return (
    <span
      className={`flex items-center justify-center rounded-full bg-gold/12 ${className}`}
      aria-hidden
    >
      <svg viewBox="0 0 24 24" className="h-1/2 w-1/2 text-gold" fill="none">
        <path
          d="M5 12c0-3.9 3.1-7 7-7s7 3.1 7 7"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
        <path d="M8 12v3M12 9v8M16 12v3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    </span>
  );
}
