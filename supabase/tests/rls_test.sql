-- ============================================================================
-- Tests des politiques RLS.
--
-- Une politique fausse ne fait pas planter l'application : elle laisse
-- tranquillement fuiter les données. C'est donc la partie du schéma qui mérite
-- le plus de tests. Chaque bloc pose une identité, exécute une requête réelle,
-- et vérifie ce qui est visible.
-- ============================================================================

\set ON_ERROR_STOP on
\timing off

-- Identités de test
insert into auth.users (id, email, raw_user_meta_data) values
  ('11111111-1111-1111-1111-111111111111', 'abdel@example.test', '{"full_name":"Abdel"}'),
  ('22222222-2222-2222-2222-222222222222', 'thomas@example.test', '{"full_name":"Thomas"}'),
  ('33333333-3333-3333-3333-333333333333', 'intrus@example.test', '{"full_name":"Intrus"}');

-- Le déclencheur doit avoir créé trois profils sans intervention applicative.
do $$
declare n int;
begin
  select count(*) into n from public.profiles;
  assert n = 3, format('3 profils attendus, %s trouvés : le déclencheur handle_new_user ne fonctionne pas', n);
end $$;

-- Abdel crée un voyage.
set role authenticated;
set request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

insert into public.trips (id, owner_id, title, origin_name, origin_lat, origin_lng)
values ('aaaaaaaa-0000-0000-0000-000000000001', auth.uid(), 'Week-end entre potes', 'Paris', 48.8566, 2.3522);

do $$
declare n int;
begin
  -- Le créateur doit être membre automatiquement.
  select count(*) into n from public.trip_members
  where trip_id = 'aaaaaaaa-0000-0000-0000-000000000001';
  assert n = 1, format('Le créateur devrait être membre automatiquement (%s membre(s))', n);

  select count(*) into n from public.trips;
  assert n = 1, format('Le créateur devrait voir son voyage (%s visible(s))', n);
end $$;

-- Abdel crée un lien d'invitation.
insert into public.trip_invites (trip_id, code, created_by)
values ('aaaaaaaa-0000-0000-0000-000000000001', 'TRIP2026', auth.uid());

reset role;
reset request.jwt.claims;

-- ---------------------------------------------------------------------------
-- L'intrus ne doit RIEN voir.
-- ---------------------------------------------------------------------------
set role authenticated;
set request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';

do $$
declare n int;
begin
  select count(*) into n from public.trips;
  assert n = 0, format('FUITE : un non-membre voit %s voyage(s)', n);

  select count(*) into n from public.trip_members;
  assert n = 0, format('FUITE : un non-membre voit %s ligne(s) de membres', n);

  select count(*) into n from public.trip_invites;
  assert n = 0, format('FUITE : un non-membre voit %s invitation(s)', n);

  -- Il ne doit pas non plus voir le profil des autres.
  select count(*) into n from public.profiles;
  assert n = 1, format('FUITE : un non-membre voit %s profil(s) au lieu du sien seul', n);
end $$;

-- Il ne peut pas s'inscrire de force dans le voyage.
do $$
begin
  begin
    insert into public.trip_members (trip_id, user_id, role)
    values ('aaaaaaaa-0000-0000-0000-000000000001', auth.uid(), 'member');
    raise exception 'FUITE : un intrus a pu s''ajouter au voyage sans code';
  exception when insufficient_privilege or check_violation then
    null; -- comportement attendu
  end;
end $$;

reset role;
reset request.jwt.claims;

-- ---------------------------------------------------------------------------
-- Thomas rejoint avec le code : la fonction est la seule porte d'entrée.
-- ---------------------------------------------------------------------------
set role authenticated;
set request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';

do $$
declare titre text;
begin
  select title into titre from public.join_trip_with_code('TRIP2026');
  assert titre = 'Week-end entre potes', format('Titre inattendu : %s', titre);
end $$;

do $$
declare n int;
begin
  select count(*) into n from public.trips;
  assert n = 1, format('Thomas devrait voir le voyage rejoint (%s)', n);

  select count(*) into n from public.trip_members;
  assert n = 2, format('Thomas devrait voir les 2 membres (%s)', n);

  select count(*) into n from public.profiles;
  assert n = 2, format('Thomas devrait voir son profil et celui d''Abdel (%s)', n);
end $$;

-- Un code inconnu doit échouer proprement.
do $$
begin
  begin
    perform public.join_trip_with_code('INCONNU1');
    raise exception 'Un code inconnu aurait dû être refusé';
  exception when sqlstate 'P0002' then null;
  end;
end $$;

-- Thomas renseigne SES préférences.
insert into public.member_preferences (trip_id, user_id, weights, budget_max_cents, submitted)
values ('aaaaaaaa-0000-0000-0000-000000000001', auth.uid(),
        '{"nightlife":0.9,"food":0.6,"culture":0.3}'::jsonb, 40000, true);

-- Mais pas celles d'Abdel.
do $$
begin
  begin
    insert into public.member_preferences (trip_id, user_id, weights)
    values ('aaaaaaaa-0000-0000-0000-000000000001',
            '11111111-1111-1111-1111-111111111111', '{"culture":1}'::jsonb);
    raise exception 'FUITE : Thomas a pu écrire les préférences d''Abdel';
  exception when insufficient_privilege then null;
  end;
end $$;

-- La contrainte de bornes doit rejeter un poids aberrant.
do $$
begin
  begin
    update public.member_preferences set weights = '{"nightlife":3}'::jsonb
    where user_id = auth.uid();
    raise exception 'Un poids de 3 aurait dû être rejeté';
  exception when check_violation then null;
  end;
end $$;

reset role;
reset request.jwt.claims;

-- ---------------------------------------------------------------------------
-- Les tables techniques sont hermétiques, même pour un membre légitime.
-- ---------------------------------------------------------------------------
set role authenticated;
set request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

-- Depuis le durcissement, ces tables ne sont plus seulement filtrées par RLS :
-- les droits de table eux-mêmes ont été retirés. La lecture comme l'écriture
-- doivent être refusées franchement, pas renvoyer zéro ligne.
do $$
declare n int;
begin
  begin
    select count(*) into n from public.api_cache;
    raise exception 'FUITE : le cache technique est lisible par un client';
  exception when insufficient_privilege then null;
  end;

  begin
    select count(*) into n from public.api_quota;
    raise exception 'FUITE : les quotas sont lisibles par un client';
  exception when insufficient_privilege then null;
  end;

  begin
    select count(*) into n from public.ai_cache;
    raise exception 'FUITE : le cache IA est lisible par un client';
  exception when insufficient_privilege then null;
  end;

  begin
    insert into public.api_cache (key, provider, payload, expires_at)
    values ('x', 'test', '{}'::jsonb, now());
    raise exception 'FUITE : un client a pu écrire dans le cache technique';
  exception when insufficient_privilege then null;
  end;
end $$;

-- La faille corrigée par la migration de durcissement : un connecté ne doit
-- plus pouvoir gonfler le compteur de quota et couper l'IA de tout le groupe.
do $$
begin
  begin
    perform public.bump_api_quota('mistral', 80, 100);
    raise exception 'FAILLE : un connecté peut encore épuiser le garde-quota';
  exception when insufficient_privilege then null;
  end;
end $$;

reset role;
reset request.jwt.claims;

-- ---------------------------------------------------------------------------
-- Le compteur de quota doit s'incrémenter de façon atomique.
-- ---------------------------------------------------------------------------
do $$
declare r record;
begin
  select * into r from public.bump_api_quota('mistral', 80, 100);
  assert r.used = 1, format('Premier appel attendu à 1, obtenu %s', r.used);
  select * into r from public.bump_api_quota('mistral', 80, 100);
  assert r.used = 2, format('Deuxième appel attendu à 2, obtenu %s', r.used);
  assert r.hard = 100, 'La limite dure devrait être conservée';
end $$;

-- ---------------------------------------------------------------------------
-- Un visiteur non connecté ne doit atteindre aucune fonction interne.
-- ---------------------------------------------------------------------------
set role anon;
reset request.jwt.claims;

do $$
declare interdit text;
begin
  foreach interdit in array array[
    'select public.bump_api_quota(''x'', 1, 2)',
    'select public.is_trip_member(''aaaaaaaa-0000-0000-0000-000000000001''::uuid)',
    'select public.join_trip_with_code(''TRIP2026'')',
    'select public.handle_new_user()',
    'select public.touch_updated_at()'
  ] loop
    begin
      execute interdit;
      raise exception 'FUITE : un visiteur anonyme peut exécuter « % »', interdit;
    exception when insufficient_privilege then null;
    end;
  end loop;
end $$;

reset role;

-- ---------------------------------------------------------------------------
-- Le catalogue est un bien commun : lisible par tous les connectés,
-- modifiable par personne depuis le client.
-- ---------------------------------------------------------------------------
set role authenticated;
set request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';

do $$
declare n int; touched int; avant numeric; apres numeric;
begin
  select count(*) into n from public.destinations;
  assert n >= 40, format('Le catalogue devrait être rempli par la migration de seed (%s)', n);

  -- Une écriture sans politique ne lève pas d'erreur en UPDATE : la ligne est
  -- simplement invisible pour la modification. On vérifie donc l'effet réel,
  -- pas l'exception.
  select cost_index into avant from public.destinations where id = 'budapest';
  update public.destinations set cost_index = 0.1 where id = 'budapest';
  get diagnostics touched = row_count;
  select cost_index into apres from public.destinations where id = 'budapest';

  assert touched = 0, format('FUITE : %s ligne(s) du catalogue modifiée(s) par un client', touched);
  assert apres = avant, 'FUITE : le catalogue a changé de valeur';

  -- En INSERT, en revanche, l'absence de politique doit refuser franchement.
  begin
    insert into public.destinations
      (id, name, country, country_code, lat, lng, tags, cost_index, poi_richness)
    values ('pirate', 'Pirate', 'Nulle part', 'XX', 0, 0, '{}'::jsonb, 1, 0.5);
    raise exception 'FUITE : un client a pu ajouter une destination';
  exception when insufficient_privilege then null;
  end;
end $$;

reset role;
reset request.jwt.claims;

-- ===========================================================================
-- Scénario complet de collaboration, en rejouant exactement les requêtes que
-- fait l'application. Le schéma local est identique à celui du projet en
-- ligne (mêmes migrations), donc ce qui passe ici passe là-bas.
-- ===========================================================================

-- L'application affiche les participants avec leur profil en une requête
-- imbriquée. PostgREST ne sait le faire que s'il existe une clé étrangère
-- entre les deux tables : on vérifie qu'elle est bien là.
do $$
declare n int;
begin
  select count(*) into n
  from pg_constraint c
  join pg_class src on src.oid = c.conrelid
  join pg_class dst on dst.oid = c.confrelid
  where c.contype = 'f' and src.relname = 'trip_members' and dst.relname = 'profiles';
  assert n = 1,
    'Sans clé étrangère trip_members → profiles, la requête imbriquée de l''écran Participants échouerait';
end $$;

-- Abdel crée un second voyage et son invitation, comme le fait l'application.
set role authenticated;
set request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

insert into public.trips (id, owner_id, title, origin_name, origin_lat, origin_lng, participants, target_month, duration_days, budget_per_person_cents)
values ('aaaaaaaa-0000-0000-0000-000000000002', auth.uid(), 'Escapade', 'Toulouse', 43.6047, 1.4442, 3, 10, 4, 40000);

insert into public.trip_invites (trip_id, code, created_by)
values ('aaaaaaaa-0000-0000-0000-000000000002', 'ESCAP123', auth.uid());

-- Abdel dépose ses envies (upsert, comme l'écran « mes envies »).
insert into public.member_preferences (trip_id, user_id, weights, budget_max_cents, avoid, submitted)
values ('aaaaaaaa-0000-0000-0000-000000000002', auth.uid(),
        '{"food":1,"nightlife":0.66}'::jsonb, 40000, '{}', true)
on conflict (trip_id, user_id) do update
  set weights = excluded.weights, budget_max_cents = excluded.budget_max_cents, submitted = true;

reset role;
reset request.jwt.claims;

-- Thomas ouvre le lien reçu et rejoint.
set role authenticated;
set request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';

do $$
declare cible uuid;
begin
  select trip_id into cible from public.join_trip_with_code('escap123'); -- minuscules acceptées
  assert cible = 'aaaaaaaa-0000-0000-0000-000000000002',
    'La fonction devrait renvoyer l''identifiant du voyage rejoint';
end $$;

-- Il renseigne des envies très différentes, et un budget plus serré.
insert into public.member_preferences (trip_id, user_id, weights, budget_max_cents, avoid, submitted)
values ('aaaaaaaa-0000-0000-0000-000000000002', auth.uid(),
        '{"culture":1,"nature":0.66}'::jsonb, 25000, '{}', true)
on conflict (trip_id, user_id) do update
  set weights = excluded.weights, budget_max_cents = excluded.budget_max_cents, submitted = true;

-- Il peut se retirer du voyage, mais pas en exclure un autre.
do $$
begin
  begin
    delete from public.trip_members
    where trip_id = 'aaaaaaaa-0000-0000-0000-000000000002'
      and user_id = '11111111-1111-1111-1111-111111111111';
    if found then
      raise exception 'FUITE : un membre a pu exclure le créateur du voyage';
    end if;
  exception when insufficient_privilege then null;
  end;
end $$;

reset role;
reset request.jwt.claims;

-- Ce que voit l'écran Participants côté Abdel : les deux requêtes réelles.
set role authenticated;
set request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

do $$
declare membres int; envies int; budget_contraignant int; invite_visible int;
begin
  select count(*) into membres
  from public.trip_members m
  join public.profiles p on p.id = m.user_id
  where m.trip_id = 'aaaaaaaa-0000-0000-0000-000000000002';
  assert membres = 2, format('2 participants attendus, %s', membres);

  select count(*), min(budget_max_cents) into envies, budget_contraignant
  from public.member_preferences
  where trip_id = 'aaaaaaaa-0000-0000-0000-000000000002';
  assert envies = 2, format('2 jeux d''envies attendus, %s', envies);

  -- La promesse produit : c'est le budget le plus serré qui contraint,
  -- pas celui du créateur.
  assert budget_contraignant = 25000,
    format('Le budget contraignant devrait être 250 €, obtenu %s', budget_contraignant);

  -- L'invitation reste consultable et son compteur d'usage a bougé.
  select uses into invite_visible from public.trip_invites where code = 'ESCAP123';
  assert invite_visible = 1, format('Le lien devrait compter 1 usage, %s', invite_visible);
end $$;

reset role;
reset request.jwt.claims;

-- Un intrus ne voit toujours rien de ce second voyage.
set role authenticated;
set request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';

do $$
declare n int;
begin
  select count(*) into n from public.member_preferences;
  assert n = 0, format('FUITE : un non-membre voit %s préférence(s)', n);
  select count(*) into n from public.trips;
  assert n = 0, format('FUITE : un non-membre voit %s voyage(s)', n);
end $$;

reset role;
reset request.jwt.claims;

-- Les tables diffusées en temps réel doivent l'être vraiment, sinon la
-- collaboration ne se met à jour qu'au rechargement.
do $$
declare manquante text;
begin
  foreach manquante in array array['trips','trip_members','member_preferences','trip_proposals','votes'] loop
    assert exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = manquante
    ), format('La table %s n''est pas diffusée en temps réel', manquante);
    assert (select relreplident from pg_class where oid = format('public.%I', manquante)::regclass) = 'f',
      format('La table %s devrait être en replica identity full pour que la RLS filtre la diffusion', manquante);
  end loop;
end $$;

select '✅ Tous les tests RLS sont passés' as resultat;
