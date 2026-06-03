-- Extensions
create extension if not exists vector with schema extensions;

-- Enums
create type public.message_role as enum ('user', 'assistant', 'system');
create type public.attachment_type as enum ('image', 'document');
create type public.document_status as enum ('pending', 'processing', 'ready', 'failed');

-- LLM model registry (supports multiple providers)
create table public.llm_models (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider in ('openai', 'google', 'anthropic', 'other')),
  model_id text not null,
  display_name text not null,
  is_enabled boolean not null default true,
  is_default boolean not null default false,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (provider, model_id)
);

create unique index llm_models_single_default_idx
  on public.llm_models (is_default)
  where is_default = true;

-- User profiles (extends auth.users)
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  avatar_url text,
  preferred_model_id uuid references public.llm_models (id) on delete set null,
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
  model_id uuid references public.llm_models (id) on delete set null,
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
  model_id uuid references public.llm_models (id) on delete set null,
  parent_message_id uuid references public.messages (id) on delete set null,
  token_count int check (token_count is null or token_count >= 0),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index messages_chat_id_created_at_idx
  on public.messages (chat_id, created_at asc);

-- Images / files attached to a message
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

-- Uploaded documents for RAG context
create table public.documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  storage_path text not null,
  file_name text not null,
  mime_type text not null,
  file_size bigint check (file_size is null or file_size >= 0),
  status public.document_status not null default 'pending',
  page_count int check (page_count is null or page_count >= 0),
  character_count int check (character_count is null or character_count >= 0),
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index documents_user_id_created_at_idx
  on public.documents (user_id, created_at desc);

-- Chunks with embeddings for semantic search
create table public.document_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents (id) on delete cascade,
  chunk_index int not null check (chunk_index >= 0),
  content text not null,
  embedding extensions.vector (1536),
  token_count int check (token_count is null or token_count >= 0),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (document_id, chunk_index)
);

create index document_chunks_document_id_idx
  on public.document_chunks (document_id);

create index document_chunks_embedding_idx
  on public.document_chunks
  using hnsw (embedding extensions.vector_cosine_ops);

-- Link documents to chats for context
create table public.chat_documents (
  chat_id uuid not null references public.chats (id) on delete cascade,
  document_id uuid not null references public.documents (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (chat_id, document_id)
);

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

create trigger set_documents_updated_at
  before update on public.documents
  for each row execute function public.set_updated_at();

-- Auto-create profile on signup
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

-- Increment question count (enforces anonymous free-tier limit)
create or replace function public.increment_question_count()
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_is_anonymous boolean;
  v_count int;
  v_max int;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  v_is_anonymous := coalesce(
    (select auth.jwt() -> 'app_metadata' ->> 'is_anonymous')::boolean,
    false
  );

  insert into public.user_usage as uu (user_id, question_count)
  values (v_user_id, 1)
  on conflict (user_id) do update
  set
    question_count = uu.question_count + 1,
    updated_at = now()
  returning question_count, max_free_questions
  into v_count, v_max;

  if v_is_anonymous and v_count > v_max then
    raise exception 'Free question limit reached (% of %)', v_count - 1, v_max;
  end if;

  return v_count;
end;
$$;

revoke all on function public.handle_new_user() from public;
revoke all on function public.handle_new_user() from anon, authenticated;

revoke all on function public.increment_question_count() from public;
revoke all on function public.increment_question_count() from anon;
grant execute on function public.increment_question_count() to authenticated;

-- Row Level Security
alter table public.llm_models enable row level security;
alter table public.profiles enable row level security;
alter table public.user_usage enable row level security;
alter table public.chats enable row level security;
alter table public.messages enable row level security;
alter table public.message_attachments enable row level security;
alter table public.documents enable row level security;
alter table public.document_chunks enable row level security;
alter table public.chat_documents enable row level security;

-- llm_models: read-only for all clients
create policy "llm_models_select"
  on public.llm_models
  for select
  to anon, authenticated
  using (is_enabled = true);

-- profiles
create policy "profiles_select_own"
  on public.profiles
  for select
  to authenticated
  using ((select auth.uid()) = id);

create policy "profiles_update_own"
  on public.profiles
  for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- user_usage
create policy "user_usage_select_own"
  on public.user_usage
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

-- chats
create policy "chats_select_own"
  on public.chats
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "chats_insert_own"
  on public.chats
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "chats_update_own"
  on public.chats
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "chats_delete_own"
  on public.chats
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- messages (via chat ownership)
create policy "messages_select_own"
  on public.messages
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.chats c
      where c.id = messages.chat_id
        and c.user_id = (select auth.uid())
    )
  );

create policy "messages_insert_own"
  on public.messages
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.chats c
      where c.id = messages.chat_id
        and c.user_id = (select auth.uid())
    )
  );

create policy "messages_update_own"
  on public.messages
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.chats c
      where c.id = messages.chat_id
        and c.user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1
      from public.chats c
      where c.id = messages.chat_id
        and c.user_id = (select auth.uid())
    )
  );

create policy "messages_delete_own"
  on public.messages
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.chats c
      where c.id = messages.chat_id
        and c.user_id = (select auth.uid())
    )
  );

-- message_attachments (via message -> chat ownership)
create policy "message_attachments_select_own"
  on public.message_attachments
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.messages m
      join public.chats c on c.id = m.chat_id
      where m.id = message_attachments.message_id
        and c.user_id = (select auth.uid())
    )
  );

create policy "message_attachments_insert_own"
  on public.message_attachments
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.messages m
      join public.chats c on c.id = m.chat_id
      where m.id = message_attachments.message_id
        and c.user_id = (select auth.uid())
    )
  );

create policy "message_attachments_delete_own"
  on public.message_attachments
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.messages m
      join public.chats c on c.id = m.chat_id
      where m.id = message_attachments.message_id
        and c.user_id = (select auth.uid())
    )
  );

-- documents
create policy "documents_select_own"
  on public.documents
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "documents_insert_own"
  on public.documents
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "documents_update_own"
  on public.documents
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "documents_delete_own"
  on public.documents
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- document_chunks (via document ownership)
create policy "document_chunks_select_own"
  on public.document_chunks
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.documents d
      where d.id = document_chunks.document_id
        and d.user_id = (select auth.uid())
    )
  );

-- chat_documents (both chat and document must belong to user)
create policy "chat_documents_select_own"
  on public.chat_documents
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.chats c
      where c.id = chat_documents.chat_id
        and c.user_id = (select auth.uid())
    )
  );

create policy "chat_documents_insert_own"
  on public.chat_documents
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.chats c
      where c.id = chat_documents.chat_id
        and c.user_id = (select auth.uid())
    )
    and exists (
      select 1
      from public.documents d
      where d.id = chat_documents.document_id
        and d.user_id = (select auth.uid())
    )
  );

create policy "chat_documents_delete_own"
  on public.chat_documents
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.chats c
      where c.id = chat_documents.chat_id
        and c.user_id = (select auth.uid())
    )
  );

-- Storage buckets
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'chat-attachments',
    'chat-attachments',
    false,
    10485760,
    array['image/jpeg', 'image/png', 'image/gif', 'image/webp']
  ),
  (
    'documents',
    'documents',
    false,
    52428800,
    array[
      'application/pdf',
      'text/plain',
      'text/markdown',
      'text/csv',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ]
  )
on conflict (id) do nothing;

-- Storage RLS: chat-attachments
create policy "chat_attachments_select_own"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'chat-attachments'
    and (select auth.uid())::text = (storage.foldername(name))[1]
  );

create policy "chat_attachments_insert_own"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'chat-attachments'
    and (select auth.uid())::text = (storage.foldername(name))[1]
  );

create policy "chat_attachments_delete_own"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'chat-attachments'
    and (select auth.uid())::text = (storage.foldername(name))[1]
  );

-- Storage RLS: documents
create policy "documents_storage_select_own"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'documents'
    and (select auth.uid())::text = (storage.foldername(name))[1]
  );

create policy "documents_storage_insert_own"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'documents'
    and (select auth.uid())::text = (storage.foldername(name))[1]
  );

create policy "documents_storage_update_own"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'documents'
    and (select auth.uid())::text = (storage.foldername(name))[1]
  )
  with check (
    bucket_id = 'documents'
    and (select auth.uid())::text = (storage.foldername(name))[1]
  );

create policy "documents_storage_delete_own"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'documents'
    and (select auth.uid())::text = (storage.foldername(name))[1]
  );

-- Realtime (sync chats/messages across tabs)
alter publication supabase_realtime add table public.chats;
alter publication supabase_realtime add table public.messages;

-- Seed default LLM models
insert into public.llm_models (provider, model_id, display_name, is_default, config)
values
  ('openai', 'gpt-4o', 'GPT-4o', true, '{"supports_vision": true}'::jsonb),
  ('openai', 'gpt-4o-mini', 'GPT-4o Mini', false, '{"supports_vision": true}'::jsonb),
  ('google', 'gemini-2.0-flash', 'Gemini 2.0 Flash', false, '{"supports_vision": true}'::jsonb),
  ('anthropic', 'claude-sonnet-4-20250514', 'Claude Sonnet 4', false, '{"supports_vision": true}'::jsonb);

-- Backfill profiles for existing auth users
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
