'use client';

import { useState } from 'react';
import { faqs } from '@/data/content';

export function FAQ() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section className="section container-content">
      <h2 className="text-3xl text-ink sm:text-4xl">Questions hosts ask us</h2>
      <div className="mt-8 max-w-2xl divide-y divide-line border-y border-line">
        {faqs.map((faq, i) => {
          const isOpen = open === i;
          return (
            <div key={faq.q}>
              <button
                type="button"
                onClick={() => setOpen(isOpen ? null : i)}
                aria-expanded={isOpen}
                className="flex w-full items-center justify-between gap-4 py-5 text-left"
              >
                <span className="text-lg text-ink">{faq.q}</span>
                <svg
                  viewBox="0 0 24 24"
                  className={`h-5 w-5 shrink-0 text-gold transition-transform duration-200 ${
                    isOpen ? 'rotate-45' : ''
                  }`}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  aria-hidden
                >
                  <path d="M12 5v14M5 12h14" strokeLinecap="round" />
                </svg>
              </button>
              {isOpen && (
                <p className="-mt-1 max-w-prose pb-5 text-base leading-relaxed text-muted animate-fade-up">
                  {faq.a}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
