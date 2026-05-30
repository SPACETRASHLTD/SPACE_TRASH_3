'use client';

import { useRef, useState } from 'react';
import Image from 'next/image';
import type { Artist } from '@/data/artists';

// Tap-to-play 30s audio clip + optional expandable bio (used on /artists).
export function ArtistCard({ artist, expandable = false }: { artist: Artist; expandable?: boolean }) {
  const [playing, setPlaying] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  const toggleAudio = () => {
    const el = audioRef.current;
    if (!el) return;
    if (playing) {
      el.pause();
    } else {
      el.currentTime = 0;
      void el.play().catch(() => setPlaying(false));
    }
    setPlaying(!playing);
  };

  return (
    <article className="group flex flex-col overflow-hidden rounded-2xl border border-line bg-white">
      <div className="relative aspect-[4/5] overflow-hidden bg-line">
        <Image
          src={artist.portrait}
          alt={`${artist.name} — ${artist.tag}`}
          fill
          sizes="(max-width: 640px) 100vw, 50vw"
          className="object-cover transition-transform duration-[400ms] ease-soft group-hover:scale-[1.03]"
        />

        {artist.audioClip && (
          <button
            type="button"
            onClick={toggleAudio}
            aria-label={playing ? `Pause ${artist.name} clip` : `Play a clip of ${artist.name}`}
            className="absolute bottom-3 left-3 flex items-center gap-2 rounded-full bg-cream/95 px-4 py-2 text-sm font-medium text-ink shadow-sm backdrop-blur transition-colors hover:bg-cream"
          >
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gold text-cream">
              {playing ? (
                <svg viewBox="0 0 24 24" className="h-3 w-3" fill="currentColor">
                  <rect x="6" y="5" width="4" height="14" rx="1" />
                  <rect x="14" y="5" width="4" height="14" rx="1" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" className="h-3 w-3" fill="currentColor">
                  <path d="M8 5v14l11-7z" />
                </svg>
              )}
            </span>
            {playing ? 'Playing' : 'Hear a clip'}
          </button>
        )}

        {artist.audioClip && (
          <audio
            ref={audioRef}
            src={artist.audioClip}
            preload="none"
            onEnded={() => setPlaying(false)}
          />
        )}
      </div>

      <div className="flex flex-1 flex-col p-5">
        <h3 className="text-xl text-ink">{artist.name}</h3>
        <p className="mt-1 text-sm text-gold">{artist.tag}</p>
        <p className="mt-3 text-base text-muted">{artist.short}</p>

        {expandable && (
          <div className="mt-4">
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              aria-expanded={expanded}
              className="text-sm font-medium text-ink underline decoration-gold/50 underline-offset-4 transition-colors hover:text-gold"
            >
              {expanded ? 'Less' : 'Read bio'}
            </button>
            {expanded && (
              <p className="mt-3 text-base leading-relaxed text-ink animate-fade-up">{artist.bio}</p>
            )}
            {artist.videoEmbed && expanded && (
              <div className="mt-4 aspect-video w-full overflow-hidden rounded-xl bg-line">
                <iframe
                  src={artist.videoEmbed}
                  title={`${artist.name} performance`}
                  className="h-full w-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            )}
          </div>
        )}
      </div>
    </article>
  );
}
