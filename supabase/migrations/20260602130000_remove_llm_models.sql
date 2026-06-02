-- Single LLM is configured via app env; no per-chat or per-user model selection.

alter table public.profiles drop column if exists preferred_model_id;
alter table public.chats drop column if exists model_id;
alter table public.messages drop column if exists model_id;

drop policy if exists "llm_models_select" on public.llm_models;
drop table if exists public.llm_models;
