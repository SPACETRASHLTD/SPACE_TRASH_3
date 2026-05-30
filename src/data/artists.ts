// Artist roster. Adding a musician = adding an object here.
// (Or swap this source for a Supabase `artists` table later — the
// components only depend on the Artist shape below.)

export type Artist = {
  slug: string;
  name: string;
  /** One-line tag shown under the name. */
  tag: string;
  /** Short line used on the homepage featured grid. */
  short: string;
  /** Expandable bio shown on the /artists page. */
  bio: string;
  /** Portrait path under /public. WebP preferred. */
  portrait: string;
  /** 30-second audio clip path under /public (tap-to-play). */
  audioClip?: string;
  /** Optional video embed URL (YouTube/Vimeo) for the artists page. */
  videoEmbed?: string;
  /** Surface in the homepage "featured" grid at launch. */
  featured: boolean;
};

export const artists: Artist[] = [
  {
    slug: 'stephen-lecky',
    name: 'Stephen Lecky',
    tag: 'Solo singer · sax, flute, guitar & vocals',
    short: 'Live deep-house fused with hits across the decades.',
    bio: "Stephen plays saxophone, flute, and guitar, and sings — weaving live deep-house with the hits everyone knows from the '60s through the 2000s. A former Canadian Idol contestant, he's a standout for house parties: one person, a full room of sound, and a read on the night that keeps the energy exactly where you want it.",
    portrait: '/artists/stephen-lecky.jpg',
    audioClip: '/artists/stephen-lecky.mp3', // PLACEHOLDER — founder to supply 30s clip
    featured: true,
  },
  {
    slug: 'sasha-veregen',
    name: 'Sasha Veregen',
    tag: 'Solo piano · all styles, jazzy feel',
    short: 'Every style with a jazzy touch, elevated with live tech.',
    bio: 'Sasha plays across every style with an effortless jazzy feel, and uses technology live to elevate his sound into something far bigger than a single piano. Equally at home as warm background texture or the center of the room, he reads the evening and brings it up gracefully.',
    portrait: '/artists/sasha-veregen.jpg',
    audioClip: '/artists/sasha-veregen.mp3', // PLACEHOLDER — founder to supply 30s clip
    featured: true,
  },
];

export const featuredArtists = artists.filter((a) => a.featured);
