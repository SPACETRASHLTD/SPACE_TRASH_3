import Image from 'next/image';
import { Nav } from '@/components/Nav';
import { FindMusicianButton } from '@/components/FindMusicianButton';
import { hero } from '@/data/content';

export function Hero() {
  return (
    <section className="relative flex min-h-[100svh] flex-col">
      <Nav />

      {/* Full-bleed warm background photo. Placeholder: /public/hero.jpg */}
      <Image
        src="/hero.jpg"
        alt="A dusk house party in Vancouver — vaulted ceiling, city lights through the windows, well-dressed guests, a musician in the corner."
        fill
        priority
        sizes="100vw"
        className="object-cover"
      />
      {/* Warm legibility wash — no harsh gradients, just enough to hold the type. */}
      <div className="absolute inset-0 bg-ink/45" />

      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-5 text-center">
        <h1 className="max-w-3xl text-balance font-serif text-4xl leading-tight text-cream sm:text-5xl md:text-6xl">
          {hero.headline}
        </h1>
        <p className="mt-5 max-w-xl text-lg text-cream/90 sm:text-xl">{hero.subhead}</p>
        <div className="mt-9">
          <FindMusicianButton label={hero.cta} />
        </div>
      </div>

      {/* Subtle scroll cue */}
      <div className="relative z-10 flex justify-center pb-8">
        <svg
          viewBox="0 0 24 24"
          className="h-6 w-6 animate-bounce text-cream/70"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden
        >
          <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </section>
  );
}
