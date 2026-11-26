-- Creates the public.users table to store and track registered, profile, & logged-in users.

create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  username text unique,
  full_name text,
  phone text,
  about text,
  date_of_birth text,
  avatar_url text,
  profile_completed boolean not null default false,
  is_verified boolean not null default false,
  is_online boolean not null default false,
  last_login_at timestamptz,
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Keep updated_at current on every row update.
create or replace function public.set_users_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_users_updated_at on public.users;
create trigger trg_users_updated_at
before update on public.users
for each row
execute function public.set_users_updated_at();

-- Automatically mirror new auth.users rows into public.users.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (
    id,
    email,
    username,
    full_name,
    phone,
    about,
    date_of_birth,
    avatar_url,
    profile_completed,
    is_verified,
    created_at,
    updated_at
  )
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'username',
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'phone',
    new.raw_user_meta_data ->> 'about',
    new.raw_user_meta_data ->> 'date_of_birth',
    new.raw_user_meta_data ->> 'avatar_url',
    coalesce((new.raw_user_meta_data ->> 'profile_completed')::boolean, false),
    new.email_confirmed_at is not null,
    coalesce(new.created_at, now()),
    now()
  )
  on conflict (id) do update
    set email = excluded.email,
        username = coalesce(excluded.username, public.users.username),
        full_name = coalesce(excluded.full_name, public.users.full_name),
        phone = coalesce(excluded.phone, public.users.phone),
        about = coalesce(excluded.about, public.users.about),
        date_of_birth = coalesce(excluded.date_of_birth, public.users.date_of_birth),
        avatar_url = coalesce(excluded.avatar_url, public.users.avatar_url),
        profile_completed = coalesce(excluded.profile_completed, public.users.profile_completed),
        is_verified = excluded.is_verified,
        updated_at = now();

  return new;
end;
$$;

revoke all on function public.handle_new_auth_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_auth_user();

-- Backfill any existing auth.users into public.users.
insert into public.users (id, email, is_verified, created_at, updated_at)
select
  id,
  email,
  email_confirmed_at is not null,
  coalesce(created_at, now()),
  now()
from auth.users
where email is not null
on conflict (id) do nothing;

-- Enable Row Level Security (RLS) and grant authenticated access.
alter table public.users enable row level security;

revoke all on table public.users from anon;
grant select, insert, update on table public.users to authenticated;
grant select, insert, update, delete on table public.users to service_role;

drop policy if exists "Authenticated users can read users" on public.users;
create policy "Authenticated users can read users"
on public.users
for select
to authenticated
using (true);

drop policy if exists "Users can insert their own profile" on public.users;
create policy "Users can insert their own profile"
on public.users
for insert
to authenticated
with check ((select auth.uid()) = id);

drop policy if exists "Users can update their own profile" on public.users;
create policy "Users can update their own profile"
on public.users
for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

-- Enable Supabase Realtime updates for public.users.
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'users'
  ) then
    alter publication supabase_realtime add table public.users;
  end if;
end;
$$;
