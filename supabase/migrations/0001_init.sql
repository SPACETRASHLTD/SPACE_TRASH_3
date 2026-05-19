-- Booking Bot — initial schema
--
-- Single-tenant MVP, but agency_id is on every row so multi-tenant is a
-- refactor (just signup + RLS), not a rewrite.
--
-- Privacy model: no event titles, locations, descriptions, or attendees
-- from Google Calendar ever land in this database. The busy_blocks table
-- stores time ranges only (per Google FreeBusy API contract).

create extension if not exists "pgcrypto";

-- ─── Enums ───────────────────────────────────────────────────────────

create type artist_status as enum ('invited', 'connected', 'revoked');
create type busy_block_source as enum ('google', 'overture', 'manual');

-- ─── agencies ────────────────────────────────────────────────────────

create table agencies (
  id                          uuid primary key default gen_random_uuid(),
  name                        text not null,
  timezone                    text not null default 'America/New_York',
  overture_api_key_encrypted  text,
  overture_api_base_url       text,
  twilio_account_sid          text,
  twilio_from_number          text,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now()
);

-- ─── artists ─────────────────────────────────────────────────────────

create table artists (
  id                    uuid primary key default gen_random_uuid(),
  agency_id             uuid not null references agencies(id) on delete cascade,
  full_name             text not null,
  phone_e164            text,
  email                 text,
  overture_contact_id   text,
  invite_token          text unique,
  status                artist_status not null default 'invited',
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index artists_agency_status_idx on artists (agency_id, status);
create index artists_phone_idx on artists (phone_e164) where phone_e164 is not null;

-- ─── google_tokens ───────────────────────────────────────────────────
-- One row per artist who has connected Google Calendar.
-- refresh_token is AES-256-GCM encrypted at the application layer
-- (TOKEN_ENCRYPTION_KEY env var) before insert.

create table google_tokens (
  artist_id                uuid primary key references artists(id) on delete cascade,
  refresh_token_encrypted  text not null,
  scope                    text not null,
  last_polled_at           timestamptz,
  last_error               text,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

-- ─── busy_blocks ─────────────────────────────────────────────────────
-- Time-range-only availability data. Source 'google' comes from FreeBusy
-- polling; 'overture' from syncing the agency's own bookings back in;
-- 'manual' from the agent setting an artist as unavailable directly.

create table busy_blocks (
  id           uuid primary key default gen_random_uuid(),
  artist_id    uuid not null references artists(id) on delete cascade,
  start_ts     timestamptz not null,
  end_ts       timestamptz not null,
  source       busy_block_source not null,
  external_id  text,
  created_at   timestamptz not null default now(),
  constraint busy_blocks_time_order check (end_ts > start_ts),
  unique (artist_id, source, start_ts, end_ts)
);

create index busy_blocks_artist_time_idx on busy_blocks (artist_id, start_ts, end_ts);
create index busy_blocks_source_idx on busy_blocks (artist_id, source);

-- ─── ical_feed_tokens ────────────────────────────────────────────────
-- Each artist gets a long random token; the .ics feed lives at
-- /feeds/artist/<token>.ics. Rotating a token (insert new row, revoke old)
-- invalidates the Overture-side import — clean offboarding.

create table ical_feed_tokens (
  token       text primary key,
  artist_id   uuid not null references artists(id) on delete cascade,
  created_at  timestamptz not null default now(),
  revoked_at  timestamptz
);

create index ical_feed_tokens_artist_idx on ical_feed_tokens (artist_id) where revoked_at is null;

-- ─── updated_at triggers ─────────────────────────────────────────────

create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger agencies_updated_at before update on agencies
  for each row execute function set_updated_at();
create trigger artists_updated_at before update on artists
  for each row execute function set_updated_at();
create trigger google_tokens_updated_at before update on google_tokens
  for each row execute function set_updated_at();

-- ─── Row Level Security ──────────────────────────────────────────────
-- Default-deny posture. Edge Functions and server routes use the
-- service_role key (bypasses RLS). Agent UI policies will be added
-- in a later migration when we wire up Supabase Auth.

alter table agencies          enable row level security;
alter table artists           enable row level security;
alter table google_tokens     enable row level security;
alter table busy_blocks       enable row level security;
alter table ical_feed_tokens  enable row level security;
