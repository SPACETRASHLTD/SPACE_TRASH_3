// Three-dot typing indicator. Human-paced, ~800ms before each bot message.
export function TypingDots() {
  return (
    <div className="flex items-center gap-1.5 px-1 py-1" aria-label="Assistant is typing">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-2 w-2 rounded-full bg-gold/70"
          style={{
            animation: 'dot-bounce 1.2s infinite ease-in-out',
            animationDelay: `${i * 0.16}s`,
          }}
        />
      ))}
    </div>
  );
}
