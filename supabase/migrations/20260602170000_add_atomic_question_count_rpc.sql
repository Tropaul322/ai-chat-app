-- Add the atomic question counter RPC for databases that already applied the
-- service-role migration before this function was introduced.

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

notify pgrst, 'reload schema';
