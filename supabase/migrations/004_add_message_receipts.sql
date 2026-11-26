-- Adds delivered_at and read_at columns to public.messages for persistent
-- WhatsApp-style single, double, and blue tick receipts.

alter table public.messages
  add column if not exists delivered_at timestamptz,
  add column if not exists read_at timestamptz;

grant update (delivered_at, read_at) on table public.messages to authenticated;

drop policy if exists "Members can update message receipts" on public.messages;
create policy "Members can update message receipts"
on public.messages
for update
to authenticated
using (
  sender_id <> (select auth.uid())
  and private.is_conversation_member(conversation_id)
)
with check (
  sender_id <> (select auth.uid())
  and private.is_conversation_member(conversation_id)
);
