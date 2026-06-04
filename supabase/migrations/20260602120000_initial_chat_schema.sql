-- Complete chat application schema.
-- Public tables are written by the app API with the service role; clients only
-- subscribe to private Realtime broadcast channels.

-- Enums
create type public.message_role as enum ('user', 'assistant', 'system');
create type public.attachment_type as enum ('image', 'document');

-- User profiles (extends auth.users)
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Free-tier usage tracking (anonymous users via signInAnonymously)
create table public.user_usage (
  user_id uuid primary key references auth.users (id) on delete cascade,
  question_count int not null default 0 check (question_count >= 0),
  max_free_questions int not null default 3 check (max_free_questions >= 0),
  updated_at timestamptz not null default now()
);

-- Chat conversations
create table public.chats (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null default 'New chat',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index chats_user_id_updated_at_idx
  on public.chats (user_id, updated_at desc);

-- Messages within a chat
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references public.chats (id) on delete cascade,
  role public.message_role not null,
  content text not null default '',
  parent_message_id uuid references public.messages (id) on delete set null,
  token_count int check (token_count is null or token_count >= 0),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index messages_chat_id_created_at_idx
  on public.messages (chat_id, created_at asc);

-- Images and lightweight documents attached to a message
create table public.message_attachments (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages (id) on delete cascade,
  attachment_type public.attachment_type not null,
  storage_path text not null,
  file_name text not null,
  mime_type text not null,
  file_size bigint check (file_size is null or file_size >= 0),
  width int check (width is null or width > 0),
  height int check (height is null or height > 0),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index message_attachments_message_id_idx
  on public.message_attachments (message_id);

-- updated_at triggers
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger set_user_usage_updated_at
  before update on public.user_usage
  for each row execute function public.set_updated_at();

create trigger set_chats_updated_at
  before update on public.chats
  for each row execute function public.set_updated_at();

create trigger set_messages_updated_at
  before update on public.messages
  for each row execute function public.set_updated_at();

-- Auto-create profile and usage rows on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (
    new.id,
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'avatar_url'
  );

  insert into public.user_usage (user_id)
  values (new.id);

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

revoke all on function public.handle_new_user() from public;
revoke all on function public.handle_new_user() from anon, authenticated;

-- Bump chat.updated_at when a message is added
create or replace function public.touch_chat_on_message()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  update public.chats
  set updated_at = now()
  where id = new.chat_id;
  return new;
end;
$$;

create trigger touch_chat_on_message_insert
  after insert on public.messages
  for each row execute function public.touch_chat_on_message();

-- Question counting is called from the API via service role and kept atomic in
-- Postgres so concurrent anonymous requests cannot bypass the free-tier cap.
create or replace function public.increment_question_count_for_user(
  p_is_anonymous boolean,
  p_user_id uuid
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

revoke all on function public.increment_question_count_for_user(boolean, uuid)
  from public, anon, authenticated;
grant execute on function public.increment_question_count_for_user(boolean, uuid)
  to service_role;

-- Public schema access is blocked for browser clients. The API uses the service
-- role and Realtime uses private broadcast channel authorization below.
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

-- Storage bucket
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'chat-attachments',
  'chat-attachments',
  false,
  10485760,
  array[
    'application/json',
    'application/pdf',
    'image/gif',
    'image/jpeg',
    'image/png',
    'image/webp',
    'text/csv',
    'text/markdown',
    'text/plain'
  ]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Realtime broadcast authorization. Public clients subscribe to private
-- broadcast topics only; Postgres changes are not used for public tables.
alter table realtime.messages enable row level security;

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

-- Backfill profiles and usage rows for existing auth users.
insert into public.profiles (id, full_name, avatar_url)
select
  u.id,
  u.raw_user_meta_data ->> 'full_name',
  u.raw_user_meta_data ->> 'avatar_url'
from auth.users u
where not exists (
  select 1 from public.profiles p where p.id = u.id
);

insert into public.user_usage (user_id)
select u.id
from auth.users u
where not exists (
  select 1 from public.user_usage uu where uu.user_id = u.id
);

notify pgrst, 'reload schema';
