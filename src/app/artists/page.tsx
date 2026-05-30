import type { Metadata } from 'next';
import Link from 'next/link';
import { ArtistCard } from '@/components/ArtistCard';
import { FindMusicianButton } from '@/components/FindMusicianButton';
import { Footer } from '@/components/sections/Footer';
import { artists } from '@/data/artists';
import { site } from '@/data/content';

export const metadata: Metadata = {
  title: 'Our musicians — Vancouver House Party',
  description: 'The full roster of live musicians we book for Vancouver house parties.',
};

export default function ArtistsPage() {
  return (
    <main>
      {/* Slim top bar (the artists page has no hero image). */}
      <header className="border-b border-line">
        <div className="container-content flex items-center justify-between px-5 py-5 sm:px-8">
          <Link href="/" className="font-serif text-lg font-medium text-ink sm:text-xl">
            {site.name}
          </Link>
          <Link
            href="/"
            className="text-base text-ink transition-colors hover:text-gold"
          >
            ← Home
          </Link>
        </div>
      </header>

      <section className="section container-content">
        <p className="eyebrow">Our musicians</p>
        <h1 className="mt-3 max-w-2xl text-balance text-4xl text-ink sm:text-5xl">
          The people who’ll play your party
        </h1>
        <p className="mt-4 max-w-xl text-lg text-muted">
          A small, handpicked roster — every one of them tested in real Vancouver living rooms.
          Tap a clip, read a bio, then let us match the right fit to your night.
        </p>

        <div className="mt-12 grid gap-6 sm:grid-cols-2">
          {artists.map((artist) => (
            <ArtistCard key={artist.slug} artist={artist} expandable />
          ))}
        </div>

        <div className="mt-14 rounded-2xl border border-line bg-white p-8 text-center">
          <h2 className="text-2xl text-ink">Not sure who fits?</h2>
          <p className="mx-auto mt-2 max-w-md text-base text-muted">
            Tell us about your party and we’ll suggest two or three musicians, with a quote, within
            24 hours.
          </p>
          <div className="mt-6 flex justify-center">
            <FindMusicianButton />
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
