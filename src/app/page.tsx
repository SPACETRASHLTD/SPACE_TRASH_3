import { Hero } from '@/components/sections/Hero';
import { RecentParties } from '@/components/sections/RecentParties';
import { HowItWorks } from '@/components/sections/HowItWorks';
import { FeaturedMusicians } from '@/components/sections/FeaturedMusicians';
import { WhoWeAre } from '@/components/sections/WhoWeAre';
import { FAQ } from '@/components/sections/FAQ';
import { FinalCTA } from '@/components/sections/FinalCTA';
import { Footer } from '@/components/sections/Footer';

export default function HomePage() {
  return (
    <main>
      <Hero />
      <RecentParties />
      <HowItWorks />
      <FeaturedMusicians />
      <WhoWeAre />
      <FAQ />
      <FinalCTA />
      <Footer />
    </main>
  );
}
