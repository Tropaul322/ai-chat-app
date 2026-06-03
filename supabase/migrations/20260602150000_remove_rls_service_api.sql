-- Service-role API access: remove table RLS and block direct client DB access.
-- Realtime uses private broadcast channels authorized via realtime.messages policies.

-- Public schema policies
drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;

drop policy if exists "user_usage_select_own" on public.user_usage;

drop policy if exists "chats_select_own" on public.chats;
drop policy if exists "chats_insert_own" on public.chats;
drop policy if exists "chats_update_own" on public.chats;
drop policy if exists "chats_delete_own" on public.chats;

drop policy if exists "messages_select_own" on public.messages;
drop policy if exists "messages_insert_own" on public.messages;
drop policy if exists "messages_update_own" on public.messages;
drop policy if exists "messages_delete_own" on public.messages;

drop policy if exists "message_attachments_select_own" on public.message_attachments;
drop policy if exists "message_attachments_insert_own" on public.message_attachments;
drop policy if exists "message_attachments_delete_own" on public.message_attachments;

-- Storage policies
drop policy if exists "chat_attachments_select_own" on storage.objects;
drop policy if exists "chat_attachments_insert_own" on storage.objects;
drop policy if exists "chat_attachments_delete_own" on storage.objects;

alter table public.profiles disable row level security;
alter table public.user_usage disable row level security;
alter table public.chats disable row level security;
alter table public.messages disable row level security;
alter table public.message_attachments disable row level security;

revoke all on table public.profiles from anon, authenticated;
revoke all on table public.user_usage from anon, authenticated;
revoke all on table public.chats from anon, authenticated;
revoke all on table public.messages from anon, authenticated;
revoke all on table public.message_attachments from anon, authenticated;

revoke all on all sequences in schema public from anon, authenticated;

-- Question counting is called from the API via service role and kept atomic in
-- Postgres so concurrent anonymous requests cannot bypass the free-tier cap.
drop function if exists public.increment_question_count();

create or replace function public.increment_question_count_for_user(
  p_user_id uuid,
  p_is_anonymous boolean
)
returns table (question_count int, max_free_questions int)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_max_free_questions int;
begin
  if p_user_id is null then
    raise exception 'User id is required';
  end if;

  return query
  insert into public.user_usage as uu (user_id, question_count)
  values (p_user_id, 1)
  on conflict (user_id) do update
  set
    question_count = uu.question_count + 1,
    updated_at = now()
  where (not p_is_anonymous) or uu.question_count < uu.max_free_questions
  returning uu.question_count, uu.max_free_questions;

  if not found then
    select uu.max_free_questions
    into v_max_free_questions
    from public.user_usage as uu
    where uu.user_id = p_user_id;

    raise exception 'Free question limit reached (%)',
      coalesce(v_max_free_questions, 0);
  end if;
end;
$$;

revoke all on function public.increment_question_count_for_user(uuid, boolean)
  from public, anon, authenticated;
grant execute on function public.increment_question_count_for_user(uuid, boolean)
  to service_role;

-- Realtime broadcast authorization (public client is only used for subscriptions).
alter table realtime.messages enable row level security;

drop policy if exists "users_receive_own_broadcast" on realtime.messages;
drop policy if exists "users_send_own_broadcast" on realtime.messages;

create policy "users_receive_own_broadcast"
  on realtime.messages
  for select
  to authenticated
  using (
    realtime.messages.extension = 'broadcast'
    and (select realtime.topic()) = 'user:' || (select auth.uid())::text
  );

create policy "users_send_own_broadcast"
  on realtime.messages
  for insert
  to authenticated
  with check (
    realtime.messages.extension = 'broadcast'
    and (select realtime.topic()) = 'user:' || (select auth.uid())::text
  );

-- Postgres changes are not used; broadcast keeps Realtime off public tables.
alter publication supabase_realtime drop table public.chats;
alter publication supabase_realtime drop table public.messages;
