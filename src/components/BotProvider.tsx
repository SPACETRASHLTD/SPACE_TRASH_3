'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

type BotContextValue = {
  open: boolean;
  openBot: () => void;
  closeBot: () => void;
  toast: string | null;
  showToast: (msg: string) => void;
};

const BotContext = createContext<BotContextValue | null>(null);

export function useBot(): BotContextValue {
  const ctx = useContext(BotContext);
  if (!ctx) throw new Error('useBot must be used within <BotProvider>');
  return ctx;
}

export function BotProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const openBot = useCallback(() => setOpen(true), []);
  const closeBot = useCallback(() => setOpen(false), []);
  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 5000);
  }, []);

  const value = useMemo(
    () => ({ open, openBot, closeBot, toast, showToast }),
    [open, openBot, closeBot, toast, showToast]
  );

  return <BotContext.Provider value={value}>{children}</BotContext.Provider>;
}
