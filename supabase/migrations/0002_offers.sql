-- Booking Bot — offers schema (Phase 3)
--
-- An offer_group is one composer submission: "send these N offers as
-- a batch." An offer is one (artist, gig) tuple in some status.
-- Multiple offers can target the same gig date — first to accept wins,
-- others auto-supersede.

create type offer_status as enum (
  'draft',        -- not yet dispatched; UI-only
  'pending',      -- SMS sent, awaiting artist response
  'accepted',     -- artist clicked Accept; booking should propagate to Overture
  'declined',     -- artist clicked Decline
  'expired',      -- 24h elapsed with no response
  'superseded'    -- another artist accepted this gig first
);

create table offer_groups (
  id                  uuid primary key default gen_random_uuid(),
  agency_id           uuid not null references agencies(id) on delete cascade,
  created_at          timestamptz not null default now(),
  notes               text
);

create index offer_groups_agency_created_idx
  on offer_groups (agency_id, created_at desc);

create table offers (
  id                   uuid primary key default gen_random_uuid(),
  agency_id            uuid not null references agencies(id) on delete cascade,
  group_id             uuid not null references offer_groups(id) on delete cascade,
  artist_id            uuid not null references artists(id) on delete restrict,

  -- gig details
  gig_start_ts         timestamptz not null,
  gig_end_ts           timestamptz not null,
  venue                text,
  fee_cents            integer,
  notes                text,

  -- offer state
  token                text not null unique,
  status               offer_status not null default 'draft',
  expires_at           timestamptz not null,
  sms_sid              text,
  sms_error            text,
  accepted_at          timestamptz,
  declined_at          timestamptz,
  created_at           timestamptz not null default now(),

  constraint offers_time_order check (gig_end_ts > gig_start_ts)
);

create index offers_agency_status_idx on offers (agency_id, status);
create index offers_artist_status_idx on offers (artist_id, status);
create index offers_group_idx          on offers (group_id);
create index offers_expires_pending_idx on offers (expires_at)
  where status = 'pending';

-- Race-condition guardrail: no two PENDING offers for the same artist
-- can cover overlapping times. The unique constraint is partial so only
-- pending rows participate.
create unique index offers_no_overlap_per_artist on offers (artist_id, gig_start_ts, gig_end_ts)
  where status = 'pending';

create trigger offers_updated_at before update on offers
  for each row execute function set_updated_at();

alter table offer_groups enable row level security;
alter table offers       enable row level security;
