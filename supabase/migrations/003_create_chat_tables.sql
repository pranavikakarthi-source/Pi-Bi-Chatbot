-- Run this in Supabase Dashboard -> SQL Editor
-- Upgrades public.users with profile columns/grants AND creates real-time chat tables.

-- 1. Ensure public.users has all profile columns & required grants
alter table public.users
  add column if not exists username text unique,
  add column if not exists phone text,
  add column if not exists about text,
  add column if not exists date_of_birth text,
  add column if not exists profile_completed boolean not null default false;

revoke all on table public.users from anon;
grant select, insert, update on table public.users to authenticated;
grant select, insert, update, delete on table public.users to service_role;

-- 2. Private helper schema to evaluate conversation membership without RLS recursion
create schema if not exists private;
grant usage on schema private to authenticated, service_role;

-- 3. Conversations table (1-on-1 direct chats & group chats)
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('direct', 'group')),
  name text,
  avatar_url text,
  created_by uuid references auth.users(id) on delete set null,
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_conversations_last_message_at
  on public.conversations (last_message_at desc);

-- 4. Conversation participants table
create table if not exists public.conversation_participants (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('admin', 'member')),
  joined_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

create index if not exists idx_conversation_participants_user_id
  on public.conversation_participants (user_id);

-- 5. Messages table (text, image, video, document)
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  content text,
  message_type text not null default 'text' check (message_type in ('text', 'image', 'video', 'document')),
  media_url text,
  media_name text,
  media_size bigint,
  media_mime text,
  delivered_at timestamptz,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_messages_conversation_created_at
  on public.messages (conversation_id, created_at asc);

-- 6. Helper function for RLS (placed in private schema)
create or replace function private.is_conversation_member(conv_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.conversation_participants cp
    where cp.conversation_id = conv_id
      and cp.user_id = (select auth.uid())
  );
$$;

revoke all on function private.is_conversation_member(uuid) from public, anon;
grant execute on function private.is_conversation_member(uuid) to authenticated, service_role;

-- 7. Grants & RLS for chat tables
alter table public.conversations enable row level security;
alter table public.conversation_participants enable row level security;
alter table public.messages enable row level security;

revoke all on table public.conversations from anon;
revoke all on table public.conversation_participants from anon;
revoke all on table public.messages from anon;

grant select, insert, update on table public.conversations to authenticated;
grant select, insert, delete on table public.conversation_participants to authenticated;
grant select, insert on table public.messages to authenticated;
grant update (delivered_at, read_at) on table public.messages to authenticated;

grant select, insert, update, delete on table public.conversations to service_role;
grant select, insert, update, delete on table public.conversation_participants to service_role;
grant select, insert, update, delete on table public.messages to service_role;

drop policy if exists "Members can view conversations" on public.conversations;
create policy "Members can view conversations"
on public.conversations
for select
to authenticated
using (private.is_conversation_member(id));

drop policy if exists "Authenticated users can create conversations" on public.conversations;
create policy "Authenticated users can create conversations"
on public.conversations
for insert
to authenticated
with check ((select auth.uid()) = created_by);

drop policy if exists "Members can update conversations" on public.conversations;
create policy "Members can update conversations"
on public.conversations
for update
to authenticated
using (private.is_conversation_member(id))
with check (private.is_conversation_member(id));

drop policy if exists "Members can view participants" on public.conversation_participants;
create policy "Members can view participants"
on public.conversation_participants
for select
to authenticated
using (private.is_conversation_member(conversation_id));

drop policy if exists "Creators can add participants" on public.conversation_participants;
create policy "Creators can add participants"
on public.conversation_participants
for insert
to authenticated
with check (
  user_id = (select auth.uid())
  or exists (
    select 1 from public.conversations c
    where c.id = conversation_id and c.created_by = (select auth.uid())
  )
);

drop policy if exists "Members can view messages" on public.messages;
create policy "Members can view messages"
on public.messages
for select
to authenticated
using (private.is_conversation_member(conversation_id));

drop policy if exists "Members can send messages" on public.messages;
create policy "Members can send messages"
on public.messages
for insert
to authenticated
with check (
  sender_id = (select auth.uid())
  and private.is_conversation_member(conversation_id)
);

-- 8. Enable Supabase Realtime for conversations, participants, and messages
do $$
declare
  tbl text;
begin
  foreach tbl in array array['conversations', 'conversation_participants', 'messages']
  loop
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = tbl
    ) then
      execute format('alter publication supabase_realtime add table public.%I', tbl);
    end if;
  end loop;
end;
$$;
