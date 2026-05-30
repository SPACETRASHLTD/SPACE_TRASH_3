import Image from 'next/image';
import { whoWeAre } from '@/data/content';

export function WhoWeAre() {
  return (
    <section className="bg-white">
      <div className="section container-content">
        <div className="grid items-center gap-10 md:grid-cols-[260px_1fr] md:gap-14">
          <div className="relative mx-auto aspect-square w-44 overflow-hidden rounded-full bg-line md:mx-0 md:w-full md:max-w-[260px]">
            <Image
              src={whoWeAre.founderPhoto}
              alt="Founder of Vancouver House Party"
              fill
              loading="lazy"
              sizes="260px"
              className="object-cover"
            />
          </div>
          <div>
            <p className="eyebrow">Who we are</p>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-ink">{whoWeAre.body}</p>
            <p className="mt-6 font-serif text-2xl text-gold">— {whoWeAre.signoff}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
