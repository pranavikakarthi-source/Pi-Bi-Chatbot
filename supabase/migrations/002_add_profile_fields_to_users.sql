-- Run this in Supabase Dashboard -> SQL Editor to add profile columns
-- and grant permissions on your existing public.users table.

alter table public.users
  add column if not exists username text unique,
  add column if not exists phone text,
  add column if not exists about text,
  add column if not exists date_of_birth text,
  add column if not exists profile_completed boolean not null default false;

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

revoke all on table public.users from anon;
grant select, insert, update on table public.users to authenticated;
grant select, insert, update, delete on table public.users to service_role;
