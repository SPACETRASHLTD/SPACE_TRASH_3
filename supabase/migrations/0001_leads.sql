-- Vancouver House Party — lead capture table.
-- Apply with the Supabase CLI (`supabase db push`) or paste into the SQL editor.

create table if not exists public.leads (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  name          text not null,
  email         text not null,
  phone         text not null,
  event_type    text,
  event_date    text,        -- free text; month-level ("June") is acceptable
  neighborhood  text,
  guest_count   text,        -- free text; "about 50" is acceptable
  vibe          text,
  budget_range  text,
  full_transcript text,
  status        text not null default 'new'
);

create index if not exists leads_created_at_idx on public.leads (created_at desc);
create index if not exists leads_status_idx on public.leads (status);

-- Leads are written server-side with the service role key, which bypasses RLS.
-- Enable RLS with no public policies so the anon/public key can never read or
-- write this table from the browser.
alter table public.leads enable row level security;

comment on table public.leads is
  'Booking leads captured by the Vancouver House Party chatbot. Written server-side only.';
