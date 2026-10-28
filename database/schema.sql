-- ShareBite: Online Food Donation & Surplus Food Redistribution Platform
-- Run this complete script in Supabase Dashboard > SQL Editor.
-- The backend uses a server-side service-role key, so backend routes enforce all permissions.
-- RLS is enabled as defense in depth; do not expose the service-role key to the browser.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  name varchar(100) not null check (char_length(trim(name)) >= 2),
  email varchar(254) not null unique,
  organization varchar(150),
  role varchar(20) not null check (role in ('donor','recipient','admin')),
  password_hash text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.donations (
  id uuid primary key default gen_random_uuid(),
  donor_id uuid not null references public.profiles(id) on delete restrict,
  title varchar(100) not null,
  category varchar(50) not null check (category in ('Prepared meals','Bakery','Fruits & vegetables','Dairy','Packaged food','Other')),
  quantity varchar(80) not null,
  location varchar(180) not null,
  pickup_deadline timestamptz not null,
  prepared_at timestamptz,
  allergen_info varchar(1000) not null default 'Not provided',
  storage_notes varchar(1000),
  description varchar(1500),
  safety_confirmed boolean not null default false check (safety_confirmed = true),
  status varchar(20) not null default 'available' check (status in ('available','claimed','completed','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (pickup_deadline > created_at - interval '1 minute')
);

create table if not exists public.claims (
  id uuid primary key default gen_random_uuid(),
  donation_id uuid not null references public.donations(id) on delete restrict,
  recipient_id uuid not null references public.profiles(id) on delete restrict,
  status varchar(20) not null default 'pending' check (status in ('pending','approved','rejected','completed','cancelled')),
  message varchar(500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (donation_id, recipient_id)
);

create index if not exists idx_donations_status_deadline on public.donations(status, pickup_deadline);
create index if not exists idx_donations_donor_created on public.donations(donor_id, created_at desc);
create index if not exists idx_claims_donation_status on public.claims(donation_id, status);
create index if not exists idx_claims_recipient_created on public.claims(recipient_id, created_at desc);
create index if not exists idx_profiles_email on public.profiles(email);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles
for each row execute function public.set_updated_at();
drop trigger if exists donations_set_updated_at on public.donations;
create trigger donations_set_updated_at before update on public.donations
for each row execute function public.set_updated_at();
drop trigger if exists claims_set_updated_at on public.claims;
create trigger claims_set_updated_at before update on public.claims
for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.donations enable row level security;
alter table public.claims enable row level security;

-- No public anon policies are intentionally added. This app accesses data through its
-- Express backend, which holds the service-role key privately and checks permissions.
-- The service-role key bypasses RLS, so never skip the backend authorization checks.
