-- ============================================================================
-- Tests de protection des trips ouverts : la fuite, le blocage, le signalement,
-- le frein. À jouer après trips_ouverts_test.sql, dont il reprend les identités
-- et les voyages.
-- ============================================================================

\set ON_ERROR_STOP on
\timing off

-- Le voyage mixte de Karim est rouvert pour ces tests.
update public.trip_publications set ferme_le = null where trip_id = 'cccc0002-0000-0000-0000-000000000002';

-- ---------------------------------------------------------------------------
-- 1. LA FUITE. Un compte connecté ne peut plus demander le motif de refus
--    d'un autre : c'était un oracle sur le genre, l'âge et les exclusions de
--    n'importe qui.
-- ---------------------------------------------------------------------------
set role authenticated;
set request.jwt.claims = '{"sub":"bbbb0008-0000-0000-0000-000000000008","role":"authenticated"}';
do $$
begin
  begin
    perform public.motif_de_refus('cccc0002-0000-0000-0000-000000000002',
                                  'bbbb0004-0000-0000-0000-000000000004');
    raise exception 'FAILLE : motif_de_refus révèle encore la situation d''un tiers';
  exception
    when insufficient_privilege then null;
    when others then if sqlerrm like 'FAILLE%' then raise; end if;
  end;

  -- Les fonctions qui s'en servent, elles, marchent toujours : elles
  -- s'exécutent avec les droits de leur propriétaire.
  perform count(*) from public.chercher_trips_ouverts('bali', array['PAR']);
end $$;
reset role; reset request.jwt.claims;

-- ---------------------------------------------------------------------------
-- 2. BLOQUER. Inès bloque Karim : le trip de Karim disparaît de sa recherche,
--    et Karim ne peut pas le deviner.
-- ---------------------------------------------------------------------------
set role authenticated;
set request.jwt.claims = '{"sub":"bbbb0004-0000-0000-0000-000000000004","role":"authenticated"}';
do $$
declare avant int; apres int;
begin
  select count(*) into avant from public.chercher_trips_ouverts('bali', array['ORY','PAR'])
   where trip_id = 'cccc0002-0000-0000-0000-000000000002';
  assert avant = 1, format('Le trip de Karim devrait d''abord être visible (%s)', avant);

  perform public.bloquer('bbbb0003-0000-0000-0000-000000000003');

  select count(*) into apres from public.chercher_trips_ouverts('bali', array['ORY','PAR'])
   where trip_id = 'cccc0002-0000-0000-0000-000000000002';
  assert apres = 0, 'Après blocage, le trip de la personne bloquée ne doit plus apparaître';

  -- On ne se bloque pas soi-même.
  begin
    perform public.bloquer(auth.uid());
    raise exception 'FAILLE : auto-blocage accepté';
  exception when others then if sqlerrm like 'FAILLE%' then raise; end if;
  end;
end $$;
reset role; reset request.jwt.claims;

do $$
declare motif text;
begin
  -- Le motif est neutre : jamais « bloqué ».
  motif := public.motif_de_refus('cccc0002-0000-0000-0000-000000000002', 'bbbb0004-0000-0000-0000-000000000004');
  assert motif = 'indisponible', format('Obtenu : %s', motif);
end $$;

-- La table des blocages n'est lisible par personne en direct : sinon Karim
-- pourrait vérifier qui l'a bloqué.
set role authenticated;
set request.jwt.claims = '{"sub":"bbbb0003-0000-0000-0000-000000000003","role":"authenticated"}';
do $$
begin
  begin
    perform 1 from public.blocages;
    raise exception 'FAILLE : la table des blocages est lisible';
  exception
    when insufficient_privilege then null;
    when others then if sqlerrm like 'FAILLE%' then raise; end if;
  end;
end $$;
reset role; reset request.jwt.claims;

-- Inès débloque : le trip revient.
set role authenticated;
set request.jwt.claims = '{"sub":"bbbb0004-0000-0000-0000-000000000004","role":"authenticated"}';
do $$
declare n int;
begin
  perform public.debloquer('bbbb0003-0000-0000-0000-000000000003');
  select count(*) into n from public.chercher_trips_ouverts('bali', array['ORY','PAR'])
   where trip_id = 'cccc0002-0000-0000-0000-000000000002';
  assert n = 1, 'Après déblocage, le trip doit réapparaître';
end $$;
reset role; reset request.jwt.claims;

-- ---------------------------------------------------------------------------
-- 3. SIGNALER. Seulement quelqu'un avec qui on a eu affaire.
-- ---------------------------------------------------------------------------
set role authenticated;
set request.jwt.claims = '{"sub":"bbbb0006-0000-0000-0000-000000000006","role":"authenticated"}';
do $$
begin
  -- « Jeune » n'a jamais croisé Karim : elle ne peut pas le viser.
  begin
    perform public.signaler_quelquun('bbbb0003-0000-0000-0000-000000000003', 'harcelement');
    raise exception 'FAILLE : signalement d''un inconnu accepté';
  exception when others then
    if sqlerrm like 'FAILLE%' then raise; end if;
    assert sqlerrm like '%sans-lien%', format('Obtenu : %s', sqlerrm);
  end;
end $$;
reset role; reset request.jwt.claims;

-- Sofia a voyagé avec Léa : elle peut la signaler. Le signalement bloque par défaut.
set role authenticated;
set request.jwt.claims = '{"sub":"bbbb0002-0000-0000-0000-000000000002","role":"authenticated"}';
do $$
begin
  perform public.signaler_quelquun('bbbb0001-0000-0000-0000-000000000001', 'comportement',
                                   'Messages insistants après le refus.');
  -- Deux fois de suite ne rend pas le signalement plus urgent.
  begin
    perform public.signaler_quelquun('bbbb0001-0000-0000-0000-000000000001', 'comportement');
    raise exception 'FAILLE : signalement en double accepté';
  exception when others then
    if sqlerrm like 'FAILLE%' then raise; end if;
    assert sqlerrm like '%deja-signale%', format('Obtenu : %s', sqlerrm);
  end;

  -- Personne ne lit les signalements en direct, pas même leur auteur.
  begin
    perform 1 from public.signalements;
    raise exception 'FAILLE : la table des signalements est lisible';
  exception
    when insufficient_privilege then null;
    when others then if sqlerrm like 'FAILLE%' then raise; end if;
  end;

  -- Et un compte ordinaire ne voit pas la file de modération.
  assert (select count(*) from public.signalements_a_traiter()) = 0,
    'Un compte ordinaire ne doit rien voir de la file de modération';
end $$;
reset role; reset request.jwt.claims;

do $$
begin
  assert exists (select 1 from public.blocages
                  where bloqueur = 'bbbb0002-0000-0000-0000-000000000002'
                    and bloque = 'bbbb0001-0000-0000-0000-000000000001'),
    'Signaler devrait aussi bloquer, par défaut';
end $$;

-- ---------------------------------------------------------------------------
-- L'administration tranche : suspendre retire la personne des trips ouverts,
-- referme les siens, et règle les autres signalements la visant.
-- ---------------------------------------------------------------------------
insert into auth.users (id, email, raw_user_meta_data)
values ('bbbb0099-0000-0000-0000-000000000099', 'admin@example.test', '{"full_name":"Admin"}');
insert into public.app_admins (email) values ('admin@example.test');

set role authenticated;
set request.jwt.claims = '{"sub":"bbbb0099-0000-0000-0000-000000000099","role":"authenticated","email":"admin@example.test"}';
do $$
declare dossier uuid;
begin
  select id into dossier from public.signalements_a_traiter() limit 1;
  assert dossier is not null, 'L''administration devrait voir le signalement';
  perform public.trancher_le_signalement(dossier, true);
end $$;
reset role; reset request.jwt.claims;

do $$
declare motif text;
begin
  assert exists (select 1 from public.profiles
                  where id = 'bbbb0001-0000-0000-0000-000000000001'
                    and suspendu_des_trips_ouverts is not null),
    'La personne signalée devrait être suspendue';
  assert not exists (select 1 from public.trip_publications
                      where trip_id = 'cccc0001-0000-0000-0000-000000000001' and ferme_le is null),
    'Ses trips ouverts devraient être refermés';
  motif := public.motif_de_refus('cccc0002-0000-0000-0000-000000000002', 'bbbb0001-0000-0000-0000-000000000001');
  assert motif = 'suspendu', format('Obtenu : %s', motif);
end $$;

-- Un compte ordinaire ne tranche pas.
set role authenticated;
set request.jwt.claims = '{"sub":"bbbb0004-0000-0000-0000-000000000004","role":"authenticated"}';
do $$
begin
  begin
    perform public.trancher_le_signalement(gen_random_uuid(), true);
    raise exception 'FAILLE : un compte ordinaire a tranché un signalement';
  exception when others then if sqlerrm like 'FAILLE%' then raise; end if;
  end;
end $$;
reset role; reset request.jwt.claims;

-- ---------------------------------------------------------------------------
-- 4. LE FREIN. Cinq candidatures en attente au plus.
-- ---------------------------------------------------------------------------
do $$
declare i int; trip uuid;
begin
  -- Cinq trips mixtes ouverts par Mehdi… qui vient d'être exclu d'un autre,
  -- mais qui peut très bien organiser les siens.
  for i in 1..6 loop
    trip := ('dddd000' || i || '-0000-0000-0000-000000000000')::uuid;
    insert into public.trips (id, owner_id, title, origin_name, origin_lat, origin_lng, origin_iata,
                              destination_locked_id, destination_mode, duration_days)
    values (trip, 'bbbb0005-0000-0000-0000-000000000005', 'Trip ' || i,
            'Paris', 48.85, 2.35, array['PAR'], 'bali', 'fixed', 7);
    insert into public.trip_publications (trip_id, resume, mixite, places_max, validation,
                                          presentation_minimum, destination_id, origine_nom, origine_iata)
    values (trip, 'Un trip de test pour vérifier le frein anti-démarchage.', 'mixte', 6,
            'organisateur', 0, 'bali', 'Paris', array['PAR']);
  end loop;
end $$;

set role authenticated;
set request.jwt.claims = '{"sub":"bbbb0008-0000-0000-0000-000000000008","role":"authenticated"}';
do $$
declare i int; deposees int := 0;
begin
  -- Les identifiants sont fixés à l'avance : un compte connecté ne peut pas
  -- lister les trips des autres, et c'est bien le but.
  for i in 1..6 loop
    begin
      perform public.postuler_au_trip(('dddd000' || i || '-0000-0000-0000-000000000000')::uuid, 'Bonjour');
      deposees := deposees + 1;
    exception when others then
      assert sqlerrm like '%trop-en-attente%', format('Refus inattendu : %s', sqlerrm);
    end;
  end loop;
  assert deposees = 5, format('Cinq candidatures en attente au plus, %s déposées', deposees);
end $$;
reset role; reset request.jwt.claims;

select '✅ Tous les tests de protection sont passés' as resultat;
