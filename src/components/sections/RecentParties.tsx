import Image from 'next/image';
import { recentParties } from '@/data/content';

export function RecentParties() {
  return (
    <section className="section container-content">
      <p className="eyebrow">Recent house parties we’ve played</p>
      {/* PLACEHOLDER testimonials — replace with real quotes + dates post-launch. */}
      <div className="mt-10 grid gap-6 md:grid-cols-3">
        {recentParties.map((p) => (
          <article
            key={p.eventType}
            className="flex flex-col overflow-hidden rounded-2xl border border-line bg-white"
          >
            <div className="relative aspect-[3/2] bg-line">
              <Image
                src={p.photo}
                alt={p.eventType}
                fill
                loading="lazy"
                sizes="(max-width: 768px) 100vw, 33vw"
                className="object-cover"
              />
            </div>
            <div className="flex flex-1 flex-col p-5">
              <h3 className="text-lg text-ink">{p.eventType}</h3>
              <p className="mt-0.5 text-sm text-muted">{p.when}</p>
              <p className="mt-4 font-serif text-lg leading-snug text-ink">“{p.quote}”</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
