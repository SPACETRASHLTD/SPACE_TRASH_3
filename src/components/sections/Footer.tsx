import Link from 'next/link';
import { site } from '@/data/content';

export function Footer() {
  return (
    <footer className="border-t border-line bg-cream">
      <div className="container-content px-5 py-14 sm:px-8">
        <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="font-serif text-xl text-ink">{site.name}</p>
            <p className="mt-1 text-sm text-muted">{site.tagline}</p>
          </div>

          <nav className="flex flex-wrap gap-x-6 gap-y-2 text-base">
            <Link href="/" className="text-ink transition-colors hover:text-gold">
              Home
            </Link>
            <Link href="/artists" className="text-ink transition-colors hover:text-gold">
              Artists
            </Link>
            <Link href={`mailto:${site.email}`} className="text-ink transition-colors hover:text-gold">
              Contact
            </Link>
          </nav>

          <div className="text-base">
            <a
              href={`mailto:${site.email}`}
              className="block text-ink transition-colors hover:text-gold"
            >
              {site.email}
            </a>
            <a
              href={site.instagram}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 block text-ink transition-colors hover:text-gold"
            >
              {site.instagramHandle}
            </a>
          </div>
        </div>

        <p className="mt-12 text-sm text-muted/70">
          © {new Date().getFullYear()} {site.name}. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
