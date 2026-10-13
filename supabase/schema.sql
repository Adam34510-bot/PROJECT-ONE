-- =====================================================================
-- PROJECT ONE : base de données Supabase
-- À exécuter UNE FOIS : Supabase > SQL Editor > New query > coller > Run.
-- Peut être relancé sans risque (les objets existants sont conservés).
-- =====================================================================

-- 1) Données de chaque utilisateur (missions, mémoire, agenda, réglages…)
create table if not exists public.user_state (
  user_id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.user_state enable row level security;

drop policy if exists "user_state: lecture de ses données" on public.user_state;
create policy "user_state: lecture de ses données" on public.user_state
  for select to authenticated using (auth.uid() = user_id);
drop policy if exists "user_state: création de ses données" on public.user_state;
create policy "user_state: création de ses données" on public.user_state
  for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "user_state: mise à jour de ses données" on public.user_state;
create policy "user_state: mise à jour de ses données" on public.user_state
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "user_state: suppression de ses données" on public.user_state;
create policy "user_state: suppression de ses données" on public.user_state
  for delete to authenticated using (auth.uid() = user_id);

-- 2) Demandes de support (lisibles par vous dans Table Editor > support_tickets)
create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  category text not null,
  subject text not null check (char_length(subject) between 1 and 200),
  message text not null check (char_length(message) between 1 and 5000),
  email text check (email is null or char_length(email) <= 200),
  mission_id text,
  created_at timestamptz not null default now()
);
alter table public.support_tickets enable row level security;

drop policy if exists "support: envoi" on public.support_tickets;
create policy "support: envoi" on public.support_tickets
  for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "support: lecture de ses demandes" on public.support_tickets;
create policy "support: lecture de ses demandes" on public.support_tickets
  for select to authenticated using (auth.uid() = user_id);

-- 3) Compteur d'utilisation de l'IA (limite quotidienne par utilisateur)
create table if not exists public.ai_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null default current_date,
  count integer not null default 0,
  primary key (user_id, day)
);
alter table public.ai_usage enable row level security;

drop policy if exists "ai_usage: lecture de sa consommation" on public.ai_usage;
create policy "ai_usage: lecture de sa consommation" on public.ai_usage
  for select to authenticated using (auth.uid() = user_id);

-- Compte un message et indique s'il est autorisé. Appelée par le serveur avec le jeton de l'utilisateur.
create or replace function public.consume_ai_quota(daily_limit integer)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  used integer;
begin
  if uid is null then
    raise exception 'Non authentifié';
  end if;
  insert into public.ai_usage (user_id, day, count)
  values (uid, current_date, 1)
  on conflict (user_id, day) do update set count = public.ai_usage.count + 1
  returning count into used;
  if used > daily_limit then
    update public.ai_usage set count = count - 1 where user_id = uid and day = current_date;
    return json_build_object('allowed', false, 'used', used - 1, 'limit', daily_limit);
  end if;
  return json_build_object('allowed', true, 'used', used, 'limit', daily_limit);
end;
$$;
revoke all on function public.consume_ai_quota(integer) from public, anon;
grant execute on function public.consume_ai_quota(integer) to authenticated;

-- 4) Suppression du compte par l'utilisateur lui-même (efface aussi toutes ses données)
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Non authentifié';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
