import Image from 'next/image';
import { FindMusicianButton } from '@/components/FindMusicianButton';
import { finalCta } from '@/data/content';

export function FinalCTA() {
  return (
    <section className="relative flex min-h-[60vh] items-center justify-center overflow-hidden">
      {/* Different warm full-bleed photo. Placeholder: /public/cta.jpg */}
      <Image
        src="/cta.jpg"
        alt="Guests gathered in a warmly lit Vancouver home as the evening winds down."
        fill
        loading="lazy"
        sizes="100vw"
        className="object-cover"
      />
      <div className="absolute inset-0 bg-ink/50" />
      <div className="relative z-10 px-5 text-center">
        <h2 className="max-w-2xl text-balance font-serif text-3xl leading-tight text-cream sm:text-4xl md:text-5xl">
          {finalCta.line}
        </h2>
        <div className="mt-8">
          <FindMusicianButton label={finalCta.cta} />
        </div>
      </div>
    </section>
  );
}
