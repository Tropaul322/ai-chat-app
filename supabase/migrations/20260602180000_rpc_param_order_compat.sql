-- Compatibility overload for PostgREST RPC resolution by argument order.
-- Some clients/request payloads may resolve to (boolean, uuid) order.
create or replace function public.increment_question_count_for_user(
  p_is_anonymous boolean,
  p_user_id uuid
)
returns table (question_count int, max_free_questions int)
language sql
security definer
set search_path = ''
as $$
  select *
  from public.increment_question_count_for_user(p_user_id, p_is_anonymous);
$$;

revoke all on function public.increment_question_count_for_user(boolean, uuid)
  from public, anon, authenticated;
grant execute on function public.increment_question_count_for_user(boolean, uuid)
  to service_role;

notify pgrst, 'reload schema';
