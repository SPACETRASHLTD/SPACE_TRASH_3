// Site copy + placeholder content. Items marked PLACEHOLDER are for the
// founder to finalize before going fully live.

export const site = {
  name: 'Vancouver House Party',
  tagline: 'Live music for Vancouver house parties',
  email: 'hello@vancouverhouseparty.com', // PLACEHOLDER
  instagram: 'https://instagram.com/vancouverhouseparty', // PLACEHOLDER
  instagramHandle: '@vancouverhouseparty',
};

export const hero = {
  // PLACEHOLDER COPY — final headline/subhead TBD by founder.
  headline: 'The night they’ll still be talking about.',
  subhead: 'Handpicked live musicians for private house parties across Vancouver.',
  cta: 'Find your musician',
};

export const recentParties = [
  {
    // PLACEHOLDER testimonials — replace with real ones post-launch.
    eventType: '60th in West Vancouver',
    when: 'Two weeks ago',
    quote: 'Guests kept asking where we found him. The room never emptied.',
    photo: '/recent/party-1.jpg',
  },
  {
    eventType: 'Anniversary in Point Grey',
    when: 'Last month',
    quote: 'Exactly the warm, easy evening we’d pictured — and zero stress.',
    photo: '/recent/party-2.jpg',
  },
  {
    eventType: 'Summer party in Kitsilano',
    when: 'In May',
    quote: 'Set up quietly, read the room perfectly, and made the night.',
    photo: '/recent/party-3.jpg',
  },
] as const;

export const howItWorks = [
  {
    n: 1,
    title: 'Tell us about your party',
    body: 'A two-minute conversation with our booking assistant — no forms, no phone tag.',
  },
  {
    n: 2,
    title: 'We send you musicians',
    body: 'Two or three handpicked options plus a quote, within 24 hours.',
  },
  {
    n: 3,
    title: 'They show up, you celebrate',
    body: 'We handle sound, setup, everything. You enjoy your own party.',
  },
] as const;

export const whoWeAre = {
  // First-name signoff; a real human within hours, not days.
  body: 'We’re working Vancouver musicians who built this because every agency we’d dealt with was slow, stiff, and stressful. So we made the opposite: a real person answers within hours, not days, and we book only for house parties — homes like yours, evenings like the one you’re planning. We’ll take care of the details so you can be a guest at your own party.',
  signoff: 'Stephen', // PLACEHOLDER — founder signoff
  founderPhoto: '/founder.jpg',
};

export const faqs = [
  {
    q: 'How much does live music for a house party usually cost?',
    // PLACEHOLDER — founder to finalize pricing.
    a: 'Most house-party bookings land in a comfortable range depending on the musician, the format (solo, duo, or band), and how long you’d like them to play. Once we know a little about your evening we’ll send a clear, all-in quote — no surprises.',
  },
  {
    q: 'What if our space is small?',
    a: 'Most of our musicians are built for exactly that. A solo performer needs only a corner and an outlet, and we bring sound that fills the room without overwhelming it. Small spaces often make for the best nights.',
  },
  {
    q: 'Can the musician learn a specific song?',
    a: 'Usually, yes — a first dance, a favourite, a song that means something to the night. Just mention it when we talk and we’ll confirm it with your musician in advance.',
  },
  {
    q: 'What if we need to cancel?',
    // PLACEHOLDER — founder to finalize policy.
    a: 'Life happens. We keep our cancellation terms straightforward and fair, and we’ll always do our best to reschedule. We’ll walk you through the specifics before anything is confirmed.',
  },
  {
    q: 'Do you cover West Van, Point Grey, North Van, Downtown and Kits?',
    // PLACEHOLDER — founder to finalize neighborhood list.
    a: 'Yes — we cover West Vancouver, Point Grey, North Vancouver, Downtown, Kitsilano and the surrounding Vancouver neighbourhoods. If you’re a little further out, just ask.',
  },
  {
    q: 'Do you handle sound equipment?',
    a: 'Always. Our musicians arrive with everything they need and set up quietly before guests arrive. You won’t see cables or scrambling — just music when it’s time.',
  },
] as const;

export const finalCta = {
  line: 'Ready to plan something they’ll remember?',
  cta: 'Find your musician',
};

// The booking assistant. Bot name is a PLACEHOLDER until the founder picks one;
// until then the UI falls back to "your booking assistant".
export const bot = {
  name: '', // PLACEHOLDER — e.g. "Margaux". Empty string => "your booking assistant".
  get displayName() {
    return this.name || 'your booking assistant';
  },
};
