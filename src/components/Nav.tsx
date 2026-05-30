'use client';

import { useState } from 'react';
import Link from 'next/link';
import { site } from '@/data/content';

// Small wordmark top-left, minimal hamburger top-right → slim overlay menu.
export function Nav() {
  const [menuOpen, setMenuOpen] = useState(false);

  const links = [
    { href: '/', label: 'Home' },
    { href: '/artists', label: 'Artists' },
    { href: `mailto:${site.email}`, label: 'Contact' },
  ];

  return (
    <>
      <header className="absolute inset-x-0 top-0 z-30">
        <div className="container-content flex items-center justify-between px-5 py-5 sm:px-8">
          <Link
            href="/"
            className="font-serif text-lg font-medium text-cream drop-shadow-sm sm:text-xl"
          >
            Vancouver House Party
          </Link>
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-label="Open menu"
            className="flex h-11 w-11 items-center justify-center rounded-full bg-cream/15 text-cream backdrop-blur transition-colors hover:bg-cream/25"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </header>

      {menuOpen && (
        <div className="fixed inset-0 z-40">
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setMenuOpen(false)}
            className="absolute inset-0 bg-ink/60 animate-fade-in"
          />
          <nav className="absolute right-0 top-0 flex h-full w-72 max-w-[80%] flex-col bg-cream p-6 shadow-xl animate-fade-up">
            <button
              type="button"
              onClick={() => setMenuOpen(false)}
              aria-label="Close menu"
              className="ml-auto flex h-10 w-10 items-center justify-center rounded-full text-muted transition-colors hover:bg-line/60 hover:text-ink"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
              </svg>
            </button>
            <ul className="mt-6 space-y-1">
              {links.map((l) => (
                <li key={l.label}>
                  <Link
                    href={l.href}
                    onClick={() => setMenuOpen(false)}
                    className="block rounded-lg px-3 py-3 font-serif text-2xl text-ink transition-colors hover:text-gold"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      )}
    </>
  );
}
