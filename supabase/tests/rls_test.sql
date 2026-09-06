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

-- Écrire dans une table technique doit être refusé net.
do $$
begin
  begin
    insert into public.api_cache (key, provider, payload, expires_at)
    values ('x', 'test', '{}'::jsonb, now());
    raise exception 'FUITE : un client a pu écrire dans le cache technique';
  exception when insufficient_privilege then null;
  end;
end $$;

do $$
declare n int;
begin
  select count(*) into n from public.api_cache;
  assert n = 0, format('FUITE : le cache technique est lisible par un client (%s ligne(s))', n);
  select count(*) into n from public.api_quota;
  assert n = 0, format('FUITE : les quotas sont lisibles par un client (%s ligne(s))', n);
  select count(*) into n from public.ai_cache;
  assert n = 0, format('FUITE : le cache IA est lisible par un client (%s ligne(s))', n);
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

select '✅ Tous les tests RLS sont passés' as resultat;
