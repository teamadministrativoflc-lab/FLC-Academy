-- FLC Academy secure quiz API - install together with 003 answer key, before frontend cutover.
-- For authenticated users, questions are selected and checked on the server.
create table if not exists public.flc_quiz_sessions (
 id uuid primary key default gen_random_uuid(),
 agent_id uuid not null references auth.users(id) on delete cascade,
 question_ids integer[] not null,
 started_at timestamptz not null default now(),
 expires_at timestamptz not null default (now() + interval '2 hours'),
 submitted_at timestamptz
);
create index if not exists flc_quiz_sessions_agent_idx on public.flc_quiz_sessions(agent_id,started_at desc);
alter table public.flc_quiz_sessions enable row level security;
revoke all on public.flc_quiz_sessions from public, anon, authenticated;

create or replace function public.flc_start_secure_quiz()
returns table(session_id uuid, question_ids integer[])
language plpgsql security definer set search_path = ''
as $$
declare v_user uuid := auth.uid(); v_ids integer[]; v_session uuid;
begin
 if v_user is null or not exists(select 1 from public.agent_profiles where id=v_user) then
  raise exception 'Usuario no autorizado';
 end if;
 perform pg_advisory_xact_lock(hashtextextended(v_user::text, 0));
 if (select count(*) from public.module_progress where agent_id=v_user and module_id in ('m1','m2','m3') and progress_percent=100) <> 3 then
  raise exception 'Completa los módulos primero';
 end if;
 if (select count(*) from public.quiz_attempts where agent_id=v_user) >= 3 or
    exists(select 1 from public.quiz_attempts where agent_id=v_user and passed) then
  raise exception 'No quedan intentos';
 end if;
 select s.id,s.question_ids into v_session,v_ids
 from public.flc_quiz_sessions s
 where s.agent_id=v_user and s.submitted_at is null and s.expires_at>now()
 order by s.started_at desc limit 1;
 if v_session is null then
  select array_agg(z.question_id order by z.topic,z.random_order) into v_ids
  from (
   select q.question_id,q.topic,random() as random_order,
    row_number() over(partition by q.topic order by random()) as rn
   from public.flc_quiz_answer_key q
  ) z where z.rn<=5;
  if coalesce(array_length(v_ids,1),0) <> 15 then raise exception 'Banco incompleto'; end if;
  insert into public.flc_quiz_sessions(agent_id,question_ids)
   values(v_user,v_ids) returning id into v_session;
 end if;
 return query select v_session,v_ids;
end; $$;
revoke all on function public.flc_start_secure_quiz() from public,anon;
grant execute on function public.flc_start_secure_quiz() to authenticated;

-- Return only the selected questions, options and topics. No answer keys.
create or replace function public.flc_get_secure_quiz_questions(p_session_id uuid)
returns table(question_id integer, topic text, q text, options jsonb)
language plpgsql security definer set search_path = ''
as $$
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 if not exists (
  select 1 from public.flc_quiz_sessions s
  where s.id=p_session_id and s.agent_id=auth.uid()
    and s.submitted_at is null and s.expires_at>now()
 ) then raise exception 'Invalid quiz session'; end if;
 return query
 select k.question_id,k.topic,k.question_text,k.options
 from public.flc_quiz_sessions s
 cross join lateral unnest(s.question_ids) with ordinality x(id,ord)
 join public.flc_quiz_answer_key k on k.question_id=x.id
 where s.id=p_session_id
 order by x.ord;
end; $$;
revoke all on function public.flc_get_secure_quiz_questions(uuid) from public,anon;
grant execute on function public.flc_get_secure_quiz_questions(uuid) to authenticated;

create or replace function public.flc_submit_secure_quiz(p_session_id uuid,p_answers jsonb)
returns table(attempts_used integer,best_score numeric,quiz_passed boolean,score_percent numeric)
language plpgsql security definer set search_path = ''
as $$
declare v_user uuid:=auth.uid(); v_s public.flc_quiz_sessions%rowtype;
 v_item jsonb; v_id integer; v_answer integer; v_correct integer;
 v_seen integer[]:='{}'; v_hits integer:=0; v_score numeric;
begin
 if v_user is null or not exists(select 1 from public.agent_profiles where id=v_user) then
  raise exception 'Usuario no autorizado';
 end if;
 perform pg_advisory_xact_lock(hashtextextended(v_user::text, 0));
 select * into v_s from public.flc_quiz_sessions
 where id=p_session_id and agent_id=v_user for update;
 if not found or v_s.submitted_at is not null or v_s.expires_at<=now() then
  raise exception 'Sesión de examen inválida o vencida';
 end if;
 if jsonb_typeof(p_answers)<>'array' or jsonb_array_length(p_answers)<>15 then
  raise exception 'Respuestas inválidas';
 end if;
 if (select count(*) from public.quiz_attempts where agent_id=v_user)>=3 or
    exists(select 1 from public.quiz_attempts where agent_id=v_user and passed) then
  raise exception 'Sin intentos disponibles';
 end if;
 for v_item in select value from jsonb_array_elements(p_answers) loop
  if jsonb_typeof(v_item)<>'object' or
    jsonb_typeof(v_item->'id')<>'number' or
    jsonb_typeof(v_item->'answer')<>'number' or
    (v_item->>'id') !~ '^[0-9]+$' or (v_item->>'answer') !~ '^[0-9]+$' then
    raise exception 'Formato de respuestas incorrecto';
  end if;
  v_id:=(v_item->>'id')::integer;
  v_answer:=(v_item->>'answer')::integer;
  if not (v_id=any(v_s.question_ids)) or v_id=any(v_seen) then
   raise exception 'Pregunta no autorizada o duplicada';
  end if;
  v_seen:=array_append(v_seen,v_id);
  select correct_index into v_correct from public.flc_quiz_answer_key where question_id=v_id;
  if v_correct is null then raise exception 'Pregunta desconocida'; end if;
  if v_answer=v_correct then v_hits:=v_hits+1; end if;
 end loop;
 v_score:=round(v_hits*100.0/15);
 insert into public.quiz_attempts(agent_id,score_percent,passed,attempted_at)
 values(v_user,v_score,v_score>=70,now());
 update public.flc_quiz_sessions set submitted_at=now() where id=v_s.id;
 return query select count(*)::integer,coalesce(max(q.score_percent),0),
  coalesce(bool_or(q.passed),false),v_score
 from public.quiz_attempts q where agent_id=v_user;
end; $$;
revoke all on function public.flc_submit_secure_quiz(uuid,jsonb) from public,anon;
grant execute on function public.flc_submit_secure_quiz(uuid,jsonb) to authenticated;

-- CRITICAL: At production cutover after deploying updated frontend,
-- REVOKE EXECUTE ON FUNCTION public.flc_record_quiz_attempt(numeric) FROM authenticated;
-- Existing endpoint otherwise accepts forged client-reported scores.
