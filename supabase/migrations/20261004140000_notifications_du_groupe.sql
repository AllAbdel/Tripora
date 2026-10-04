-- ============================================================================
-- Les notifications du groupe.
--
-- Tripora prévenait d'une seule chose, la baisse d'un prix suivi. Tout le
-- reste — un message dans la discussion, une dépense, un ami qui rejoint le
-- voyage, la destination enfin arrêtée — attendait qu'on rouvre
-- l'application pour être vu. C'est pourtant ce qui fait revenir un groupe.
--
-- Le principe :
--
--   1. ce qui se passe dans un voyage est mis en file par la base elle-même
--      (des déclencheurs), une ligne par destinataire — jamais pour celui qui
--      agit, jamais pour qui n'a abonné aucun appareil ni pour une catégorie
--      qu'il a coupée ;
--   2. toutes les minutes, si la file n'est pas vide, pg_cron appelle la
--      fonction `envoyer-les-notifications`, qui chiffre chaque notification
--      pour chaque appareil (RFC 8291) et la remet au service de
--      notification du navigateur. Ce service ne lit rien : ni nom, ni
--      message, ni montant ;
--   3. une fois envoyée, une ligne perd son contenu ; elle ne garde que sa
--      clé, pour ne pas prévenir deux fois de la même chose, et disparaît au
--      bout de sept jours.
--
-- Les votes restent anonymes : on prévient l'organisateur que tout le monde a
-- voté, jamais de qui a voté quoi.
-- ============================================================================

-- ------------------------------------------------------------- Réglages --

-- Quatre catégories, toutes ouvertes tant qu'on n'a rien coupé. Une ligne
-- n'existe que pour qui a changé quelque chose.
create table public.reglages_de_notification (
  user_id    uuid primary key references auth.users(id) on delete cascade default auth.uid(),
  discussion boolean not null default true,
  depenses   boolean not null default true,
  decisions  boolean not null default true,
  groupe     boolean not null default true,
  modifie_le timestamptz not null default now()
);

alter table public.reglages_de_notification enable row level security;

create policy "réglages : les siens (lecture)"
  on public.reglages_de_notification for select to authenticated
  using (user_id = (select auth.uid()));
create policy "réglages : les siens (création)"
  on public.reglages_de_notification for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "réglages : les siens (modification)"
  on public.reglages_de_notification for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

revoke all on public.reglages_de_notification from anon;
grant select, insert, update on public.reglages_de_notification to authenticated;

-- ------------------------------------------------------------------ File --

create table public.notifications_a_envoyer (
  id           bigint generated always as identity primary key,
  destinataire uuid not null references auth.users(id) on delete cascade,
  trip_id      uuid references public.trips(id) on delete cascade,
  genre        text not null check (genre in (
                 'message', 'depense', 'membre', 'sondage', 'destination', 'tache', 'tous_ont_vote', 'envies'
               )),
  -- Ce que la notification dira : des noms, un extrait, un montant. Vidé dès
  -- l'envoi.
  donnees      jsonb not null default '{}'::jsonb,
  -- Ce qui ne se dit qu'une fois (« tout le monde a voté »).
  cle          text,
  -- Ce qui se regroupe tant que ce n'est pas parti : trois messages en une
  -- minute font une seule notification.
  groupe       text,
  cree_le      timestamptz not null default now(),
  envoye_le    timestamptz
);

create unique index notifications_cle_idx on public.notifications_a_envoyer (cle);
create unique index notifications_groupe_en_attente_idx on public.notifications_a_envoyer (groupe)
  where envoye_le is null;
create index notifications_en_attente_idx on public.notifications_a_envoyer (id) where envoye_le is null;
create index notifications_destinataire_idx on public.notifications_a_envoyer (destinataire);
create index notifications_voyage_idx on public.notifications_a_envoyer (trip_id);

-- Personne côté client : seule la fonction d'envoi (rôle de service) lit et
-- écrit cette table.
alter table public.notifications_a_envoyer enable row level security;
revoke all on public.notifications_a_envoyer from anon, authenticated;

-- ------------------------------------------------------------ Mise en file --

create or replace function public.categorie_de_notification(p_genre text)
returns text language sql immutable set search_path = public as $$
  select case p_genre
    when 'message' then 'discussion'
    when 'depense' then 'depenses'
    when 'destination' then 'decisions'
    when 'sondage' then 'decisions'
    when 'tous_ont_vote' then 'decisions'
    else 'groupe'
  end;
$$;

create or replace function public.notification_voulue(p_destinataire uuid, p_genre text)
returns boolean language sql stable security definer set search_path = public as $$
  select
    exists (select 1 from public.push_subscriptions a where a.user_id = p_destinataire)
    and coalesce((
      select case public.categorie_de_notification(p_genre)
        when 'discussion' then r.discussion
        when 'depenses' then r.depenses
        when 'decisions' then r.decisions
        else r.groupe
      end
      from public.reglages_de_notification r
      where r.user_id = p_destinataire
    ), true);
$$;

/**
 * Met une notification en file pour une personne, si elle la veut.
 *
 * `p_groupe` : remplace la notification encore en attente du même groupe, en
 * comptant (« 3 nouveaux messages »). `p_cle` : ne met rien en file si la même
 * clé y est déjà, envoyée ou non.
 */
create or replace function public.mettre_en_file(
  p_destinataire uuid,
  p_trip uuid,
  p_genre text,
  p_donnees jsonb,
  p_cle text default null,
  p_groupe text default null
)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_destinataire is null or not public.notification_voulue(p_destinataire, p_genre) then
    return;
  end if;
  if p_groupe is not null then
    insert into public.notifications_a_envoyer (destinataire, trip_id, genre, donnees, groupe)
    values (p_destinataire, p_trip, p_genre, p_donnees, p_groupe)
    on conflict (groupe) where envoye_le is null
    do update set
      donnees = excluded.donnees || jsonb_build_object(
        'nombre', coalesce((public.notifications_a_envoyer.donnees ->> 'nombre')::integer, 1) + 1
      ),
      cree_le = now();
  else
    insert into public.notifications_a_envoyer (destinataire, trip_id, genre, donnees, cle)
    values (p_destinataire, p_trip, p_genre, p_donnees, p_cle)
    on conflict (cle) do nothing;
  end if;
end;
$$;

-- Le nom affiché d'une personne, tel que le groupe le connaît.
create or replace function public.nom_pour_notification(p_user uuid)
returns text language sql stable security definer set search_path = public as $$
  select coalesce(nullif(btrim(p.display_name), ''), 'Quelqu’un') from public.profiles p where p.id = p_user;
$$;

-- Le titre du voyage, ou rien s'il a été supprimé : on ne prévient pas pour un
-- voyage qui n'existe plus.
create or replace function public.voyage_pour_notification(p_trip uuid)
returns text language sql stable security definer set search_path = public as $$
  select t.title from public.trips t where t.id = p_trip and t.deleted_at is null;
$$;

revoke all on function public.categorie_de_notification(text) from public, anon, authenticated;
revoke all on function public.notification_voulue(uuid, text) from public, anon, authenticated;
revoke all on function public.mettre_en_file(uuid, uuid, text, jsonb, text, text) from public, anon, authenticated;
revoke all on function public.nom_pour_notification(uuid) from public, anon, authenticated;
revoke all on function public.voyage_pour_notification(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------- Les événements --

-- Un message dans la discussion : pour tous les autres membres, regroupé.
create or replace function public.notifier_un_message()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  voyage text := public.voyage_pour_notification(new.trip_id);
  membre record;
begin
  if voyage is null or new.deleted_at is not null then return null; end if;
  for membre in select m.user_id from public.trip_members m where m.trip_id = new.trip_id and m.user_id <> new.author_id loop
    perform public.mettre_en_file(
      membre.user_id, new.trip_id, 'message',
      jsonb_build_object('qui', public.nom_pour_notification(new.author_id), 'voyage', voyage, 'extrait', left(btrim(new.body), 140)),
      null, 'message:' || new.trip_id || ':' || membre.user_id
    );
  end loop;
  return null;
end;
$$;

create trigger notifier_un_message after insert on public.trip_messages
  for each row execute function public.notifier_un_message();

-- Une dépense : pour chaque personne qui en a une part, sauf qui l'a saisie.
-- Les parts s'écrivent juste après la dépense ; c'est elles qu'on écoute.
create or replace function public.notifier_une_depense()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  depense public.expenses;
  voyage text;
begin
  select * into depense from public.expenses where id = new.expense_id;
  if depense.id is null or new.user_id = depense.created_by then return null; end if;
  voyage := public.voyage_pour_notification(depense.trip_id);
  if voyage is null then return null; end if;
  perform public.mettre_en_file(
    new.user_id, depense.trip_id, 'depense',
    jsonb_build_object(
      'qui', public.nom_pour_notification(depense.created_by),
      'voyage', voyage,
      'libelle', left(depense.label, 80),
      'montant', depense.amount_cents,
      'devise', depense.currency
    ),
    'depense:' || depense.id || ':' || new.user_id
  );
  return null;
end;
$$;

create trigger notifier_une_depense after insert on public.expense_shares
  for each row execute function public.notifier_une_depense();

-- Quelqu'un rejoint le voyage : pour les membres déjà là.
create or replace function public.notifier_une_arrivee()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  voyage text := public.voyage_pour_notification(new.trip_id);
  membre record;
begin
  if voyage is null then return null; end if;
  for membre in select m.user_id from public.trip_members m where m.trip_id = new.trip_id and m.user_id <> new.user_id loop
    perform public.mettre_en_file(
      membre.user_id, new.trip_id, 'membre',
      jsonb_build_object('qui', public.nom_pour_notification(new.user_id), 'voyage', voyage),
      'membre:' || new.trip_id || ':' || new.user_id || ':' || membre.user_id
    );
  end loop;
  return null;
end;
$$;

create trigger notifier_une_arrivee after insert on public.trip_members
  for each row execute function public.notifier_une_arrivee();

-- Un nouveau sondage : pour tous les autres membres.
create or replace function public.notifier_un_sondage()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  voyage text := public.voyage_pour_notification(new.trip_id);
  membre record;
begin
  if voyage is null then return null; end if;
  for membre in
    select m.user_id from public.trip_members m
    where m.trip_id = new.trip_id and m.user_id is distinct from new.cree_par
  loop
    perform public.mettre_en_file(
      membre.user_id, new.trip_id, 'sondage',
      jsonb_build_object(
        'qui', public.nom_pour_notification(new.cree_par),
        'voyage', voyage,
        'question', left(new.question, 140),
        'secret', new.secret
      ),
      'sondage:' || new.id || ':' || membre.user_id
    );
  end loop;
  return null;
end;
$$;

create trigger notifier_un_sondage after insert on public.sondages
  for each row execute function public.notifier_un_sondage();

-- La destination est arrêtée : pour tout le groupe, sauf qui a tranché.
create or replace function public.notifier_la_destination()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  voyage text;
  ville text;
  membre record;
begin
  if new.destination_locked_id is null or old.destination_locked_id is not distinct from new.destination_locked_id then
    return null;
  end if;
  voyage := public.voyage_pour_notification(new.id);
  if voyage is null then return null; end if;
  select d.name into ville from public.destinations d where d.id = new.destination_locked_id;
  for membre in
    select m.user_id from public.trip_members m
    where m.trip_id = new.id and m.user_id is distinct from auth.uid()
  loop
    perform public.mettre_en_file(
      membre.user_id, new.id, 'destination',
      jsonb_build_object('voyage', voyage, 'destination', coalesce(ville, new.destination_locked_id), 'destinationId', new.destination_locked_id),
      'destination:' || new.id || ':' || new.destination_locked_id || ':' || membre.user_id
    );
  end loop;
  return null;
end;
$$;

create trigger notifier_la_destination after update of destination_locked_id on public.trips
  for each row execute function public.notifier_la_destination();

-- Une tâche confiée à quelqu'un d'autre que soi.
create or replace function public.notifier_une_tache()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  qui uuid := coalesce(auth.uid(), new.cree_par);
  voyage text;
begin
  if new.responsable is null or new.responsable is not distinct from qui or new.faite then return null; end if;
  if tg_op = 'UPDATE' and old.responsable is not distinct from new.responsable then return null; end if;
  voyage := public.voyage_pour_notification(new.trip_id);
  if voyage is null then return null; end if;
  perform public.mettre_en_file(
    new.responsable, new.trip_id, 'tache',
    jsonb_build_object('qui', public.nom_pour_notification(qui), 'voyage', voyage, 'titre', left(new.titre, 140)),
    'tache:' || new.id || ':' || new.responsable
  );
  return null;
end;
$$;

create trigger notifier_une_tache after insert or update of responsable on public.taches
  for each row execute function public.notifier_une_tache();

-- Tout le groupe a voté sur la destination : l'organisateur peut trancher.
-- Ni qui, ni quoi — seulement que personne ne manque.
create or replace function public.notifier_les_votes_complets()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  voyage public.trips;
  membres integer;
  votants integer;
begin
  if new.subject_type <> 'proposal' then return null; end if;
  select * into voyage from public.trips where id = new.trip_id;
  if voyage.id is null or voyage.deleted_at is not null or voyage.destination_locked_id is not null
     or voyage.owner_id is not distinct from auth.uid() then
    return null;
  end if;
  select count(*) into membres from public.trip_members where trip_id = new.trip_id;
  select count(distinct user_id) into votants from public.votes where trip_id = new.trip_id and subject_type = 'proposal';
  if membres < 2 or votants < membres then return null; end if;
  perform public.mettre_en_file(
    voyage.owner_id, voyage.id, 'tous_ont_vote',
    jsonb_build_object('voyage', voyage.title, 'votants', votants),
    'tous_ont_vote:' || voyage.id
  );
  return null;
end;
$$;

create trigger notifier_les_votes_complets after insert on public.votes
  for each row execute function public.notifier_les_votes_complets();

-- --------------------------------------------------- Le rappel des envies --

/**
 * Chaque jour : qui n'a pas encore donné ses envies dans un voyage où le
 * groupe attend (destination pas arrêtée, au moins deux membres, rejoint
 * depuis plus d'un jour). Une fois par semaine au plus, et plus après deux
 * mois : un voyage oublié ne relance pas indéfiniment.
 *
 * Fait aussi le ménage : les notifications envoyées depuis plus de sept jours
 * disparaissent.
 */
create or replace function public.rappeler_les_envies()
returns integer language plpgsql security definer set search_path = public as $$
declare
  attente record;
  avant integer;
  apres integer;
begin
  delete from public.notifications_a_envoyer where envoye_le < now() - interval '7 days';
  select count(*) into avant from public.notifications_a_envoyer;
  for attente in
    select m.trip_id, m.user_id, t.title
    from public.trip_members m
    join public.trips t on t.id = m.trip_id
    left join public.member_preferences p on p.trip_id = m.trip_id and p.user_id = m.user_id
    where t.deleted_at is null
      and t.destination_locked_id is null
      and t.created_at > now() - interval '60 days'
      and m.joined_at < now() - interval '1 day'
      and not coalesce(p.submitted, false)
      and (select count(*) from public.trip_members autres where autres.trip_id = m.trip_id) >= 2
  loop
    perform public.mettre_en_file(
      attente.user_id, attente.trip_id, 'envies',
      jsonb_build_object('voyage', attente.title),
      'envies:' || attente.trip_id || ':' || attente.user_id || ':' || to_char(now(), 'IYYY-IW')
    );
  end loop;
  select count(*) into apres from public.notifications_a_envoyer;
  return apres - avant;
end;
$$;

revoke all on function public.rappeler_les_envies() from public, anon, authenticated;

-- ------------------------------------------------------- La planification --

do $planification$
begin
  if not exists (select 1 from pg_available_extensions where name = 'pg_cron')
     or not exists (select 1 from pg_namespace where nspname = 'net') then
    raise notice 'pg_cron ou pg_net absent : notifications non planifiées (base de test).';
    return;
  end if;

  create extension if not exists pg_cron with schema pg_catalog;

  -- Toutes les minutes, mais seulement s'il y a quelque chose à envoyer : la
  -- fonction n'est pas réveillée pour rien.
  perform cron.schedule(
    'envoyer-les-notifications',
    '* * * * *',
    $job$
    select net.http_post(
      url := 'https://eelvllvgnsohznconfpt.supabase.co/functions/v1/envoyer-les-notifications',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVlbHZsbHZnbnNvaHpuY29uZnB0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg2MzkxMTksImV4cCI6MjEwNDIxNTExOX0.QzyYAuYadGY7aLTx2ujfXsMN7gE7bK7dgZRoJ53k2Es'
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 60000
    )
    where exists (select 1 from public.notifications_a_envoyer where envoye_le is null)
    $job$
  );

  -- Le rappel des envies, en fin d'après-midi (heure de Paris).
  perform cron.schedule('rappeler-les-envies', '13 16 * * *', 'select public.rappeler_les_envies()');
end
$planification$;
