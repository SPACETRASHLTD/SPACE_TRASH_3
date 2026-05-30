import Link from 'next/link';
import { ArtistCard } from '@/components/ArtistCard';
import { featuredArtists } from '@/data/artists';

export function FeaturedMusicians() {
  return (
    <section className="section container-content">
      <h2 className="text-3xl text-ink sm:text-4xl">A few of our musicians</h2>
      {/* 2x2 grid on desktop, single column on mobile. Ready for more artists. */}
      <div className="mt-10 grid gap-6 sm:grid-cols-2">
        {featuredArtists.map((artist) => (
          <ArtistCard key={artist.slug} artist={artist} />
        ))}
      </div>
      <div className="mt-8">
        <Link
          href="/artists"
          className="text-base font-medium text-ink underline decoration-gold/50 underline-offset-4 transition-colors hover:text-gold"
        >
          See all musicians →
        </Link>
      </div>
    </section>
  );
}
