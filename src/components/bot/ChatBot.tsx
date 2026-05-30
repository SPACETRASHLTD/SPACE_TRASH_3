'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useBot } from '@/components/BotProvider';
import { bot } from '@/data/content';
import { BotIcon } from './BotIcon';
import { TypingDots } from './TypingDots';

type Message = { role: 'user' | 'assistant'; content: string };

const TYPING_MS = 800; // human-paced pause before each bot message

export function ChatBot() {
  const { open, closeBot, showToast } = useBot();
  const [messages, setMessages] = useState<Message[]>([]);
  const [quickReplies, setQuickReplies] = useState<string[]>([]);
  const [typing, setTyping] = useState(false);
  const [input, setInput] = useState('');
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const started = useRef(false);

  const assistantName = bot.displayName;

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    });
  }, []);

  // Send the current history to the server, reveal the reply after a typing pause.
  const exchange = useCallback(
    async (history: Message[]) => {
      setTyping(true);
      setQuickReplies([]);
      setError(null);
      const startedAt = Date.now();

      try {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: history }),
        });
        const data = await res.json();

        // Hold the typing indicator for a natural minimum beat.
        const elapsed = Date.now() - startedAt;
        if (elapsed < TYPING_MS) {
          await new Promise((r) => setTimeout(r, TYPING_MS - elapsed));
        }

        if (!res.ok) {
          setError(data.error || 'Something went wrong. Please try again.');
          setTyping(false);
          return;
        }

        setMessages((prev) => [...prev, { role: 'assistant', content: data.reply }]);
        setQuickReplies(Array.isArray(data.quickReplies) ? data.quickReplies : []);
        setTyping(false);

        if (data.done) {
          setDone(true);
          // Warm close, then dismiss the sheet and surface a subtle toast.
          window.setTimeout(() => {
            closeBot();
            showToast('Thanks — we’ll be in touch within 24 hours.');
          }, 2200);
        }
      } catch {
        const elapsed = Date.now() - startedAt;
        if (elapsed < TYPING_MS) await new Promise((r) => setTimeout(r, TYPING_MS - elapsed));
        setError('We couldn’t reach the assistant. Please try again.');
        setTyping(false);
      }
    },
    [closeBot, showToast]
  );

  // Kick off the greeting once, the first time the sheet opens.
  useEffect(() => {
    if (open && !started.current) {
      started.current = true;
      exchange([]);
    }
  }, [open, exchange]);

  // Manage focus + body scroll lock + Escape to close while open.
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeBot();
    };
    window.addEventListener('keydown', onKey);
    window.setTimeout(() => inputRef.current?.focus(), 350);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, closeBot]);

  useEffect(scrollToBottom, [messages, typing, quickReplies, scrollToBottom]);

  const send = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || typing || done) return;
      const next: Message[] = [...messages, { role: 'user', content: trimmed }];
      setMessages(next);
      setInput('');
      exchange(next);
    },
    [messages, typing, done, exchange]
  );

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center sm:items-center sm:p-6">
      {/* Dark backdrop — the page is de-prioritized behind it. */}
      <button
        type="button"
        aria-label="Close chat"
        onClick={closeBot}
        className="absolute inset-0 bg-ink/55 animate-fade-in backdrop-blur-[1px]"
      />

      {/* Full-screen sheet on mobile, centered card on desktop. */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Chat with ${assistantName}`}
        className="relative flex w-full max-w-lg flex-col bg-cream shadow-xl
          animate-sheet-up sm:max-h-[80vh] sm:rounded-2xl sm:animate-scale-in"
      >
        {/* Header */}
        <header className="flex items-center gap-3 border-b border-line px-5 py-4">
          <BotIcon className="h-10 w-10 shrink-0" />
          <div className="min-w-0">
            <p className="truncate font-serif text-lg leading-tight text-ink">{assistantName}</p>
            <p className="truncate text-sm text-muted">Vancouver House Party</p>
          </div>
          <button
            type="button"
            onClick={closeBot}
            aria-label="Close"
            className="ml-auto flex h-10 w-10 items-center justify-center rounded-full text-muted transition-colors hover:bg-line/60 hover:text-ink"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
            </svg>
          </button>
        </header>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
          {messages.map((m, i) => (
            <Bubble key={i} role={m.role} text={m.content} />
          ))}

          {typing && (
            <div className="flex items-end gap-2">
              <BotIcon className="h-7 w-7 shrink-0" />
              <div className="rounded-2xl rounded-bl-md bg-white px-4 py-3 ring-1 ring-line">
                <TypingDots />
              </div>
            </div>
          )}

          {error && (
            <p className="rounded-xl bg-gold/10 px-4 py-3 text-sm text-gold-dark">{error}</p>
          )}

          {/* Quick-reply pills */}
          {!typing && !done && quickReplies.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-1">
              {quickReplies.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => send(q)}
                  className="rounded-full border border-gold/40 bg-gold/5 px-4 py-2 text-sm font-medium text-gold-dark transition-colors hover:bg-gold/15"
                >
                  {q}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Composer */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
          className="flex items-center gap-2 border-t border-line px-3 py-3"
        >
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={done}
            placeholder={done ? 'Talk soon.' : 'Type your message…'}
            className="min-h-[48px] flex-1 rounded-full border border-line bg-white px-5 text-base text-ink outline-none transition-colors placeholder:text-muted focus:border-gold disabled:opacity-60"
            autoComplete="off"
            enterKeyHint="send"
          />
          <button
            type="submit"
            disabled={typing || done || !input.trim()}
            aria-label="Send"
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gold text-cream transition-colors hover:bg-gold-dark disabled:opacity-40"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </form>
      </div>
    </div>
  );
}

function Bubble({ role, text }: { role: 'user' | 'assistant'; text: string }) {
  if (role === 'user') {
    return (
      <div className="flex justify-end animate-fade-up">
        <div className="max-w-[82%] rounded-2xl rounded-br-md bg-gold px-4 py-3 text-base text-cream">
          {text}
        </div>
      </div>
    );
  }
  return (
    <div className="flex items-end gap-2 animate-fade-up">
      <BotIcon className="h-7 w-7 shrink-0" />
      <div className="max-w-[82%] whitespace-pre-wrap rounded-2xl rounded-bl-md bg-white px-4 py-3 text-base text-ink ring-1 ring-line">
        {text}
      </div>
    </div>
  );
}
