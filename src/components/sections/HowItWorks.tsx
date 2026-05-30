import { howItWorks } from '@/data/content';

export function HowItWorks() {
  return (
    <section className="bg-white">
      <div className="section container-content">
        <p className="eyebrow">How it works</p>
        <div className="mt-10 grid gap-10 md:grid-cols-3 md:gap-8">
          {howItWorks.map((step) => (
            <div key={step.n} className="relative">
              {/* Large faint numeral */}
              <span
                className="block font-serif text-7xl leading-none text-gold/15"
                aria-hidden
              >
                {step.n}
              </span>
              <h3 className="mt-3 text-xl text-ink">{step.title}</h3>
              <p className="mt-2 text-base text-muted">{step.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
