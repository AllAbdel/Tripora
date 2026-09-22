-- ============================================================================
-- Tests des trips ouverts.
--
-- Ouvrir un voyage à des inconnus met la règle d'admission sur le chemin
-- critique : si elle se trompe, quelqu'un entre là où il n'aurait pas dû, et
-- ça n'a rien d'une fuite de données abstraite — c'est une personne dans un
-- groupe qui avait demandé autre chose.
--
-- Ces tests attaquent donc la règle par l'écriture directe, comme le ferait
-- quelqu'un avec la clé publique et un client PostgREST, et pas seulement par
-- l'écran.
-- ============================================================================

\set ON_ERROR_STOP on
\timing off

insert into auth.users (id, email, raw_user_meta_data) values
  ('bbbb0001-0000-0000-0000-000000000001', 'lea@example.test',    '{"full_name":"Léa"}'),
  ('bbbb0002-0000-0000-0000-000000000002', 'sofia@example.test',  '{"full_name":"Sofia"}'),
  ('bbbb0003-0000-0000-0000-000000000003', 'karim@example.test',  '{"full_name":"Karim"}'),
  ('bbbb0004-0000-0000-0000-000000000004', 'ines@example.test',   '{"full_name":"Inès"}'),
  ('bbbb0005-0000-0000-0000-000000000005', 'mehdi@example.test',  '{"full_name":"Mehdi"}'),
  ('bbbb0006-0000-0000-0000-000000000006', 'jeune@example.test',  '{"full_name":"Jeune"}'),
  ('bbbb0007-0000-0000-0000-000000000007', 'discret@example.test','{"full_name":"Discret"}');

-- Les profils : genre et année déclarés, sauf pour « Discret » qui ne dit rien.
update public.profiles set genre = 'femme', annee_naissance = 1998 where id = 'bbbb0001-0000-0000-0000-000000000001';
update public.profiles set genre = 'femme', annee_naissance = 1996 where id = 'bbbb0002-0000-0000-0000-000000000002';
update public.profiles set genre = 'homme', annee_naissance = 1995 where id = 'bbbb0003-0000-0000-0000-000000000003';
update public.profiles set genre = 'femme', annee_naissance = 1999 where id = 'bbbb0004-0000-0000-0000-000000000004';
update public.profiles set genre = 'homme', annee_naissance = 1994 where id = 'bbbb0005-0000-0000-0000-000000000005';
update public.profiles set genre = 'femme', annee_naissance = 2012 where id = 'bbbb0006-0000-0000-0000-000000000006';

-- ---------------------------------------------------------------------------
-- Léa ouvre un voyage à Bali, au départ de Paris, réservé aux femmes.
-- ---------------------------------------------------------------------------
set role authenticated;
set request.jwt.claims = '{"sub":"bbbb0001-0000-0000-0000-000000000001","role":"authenticated"}';

insert into public.trips (id, owner_id, title, origin_name, origin_lat, origin_lng, origin_iata,
                          destination_locked_id, destination_mode, duration_days)
values ('cccc0001-0000-0000-0000-000000000001', auth.uid(), 'Bali entre filles',
        'Paris-Orly', 48.7233, 2.3794, array['ORY','PAR'], 'bali', 'fixed', 10);

select public.publier_le_trip(
  'cccc0001-0000-0000-0000-000000000001',
  'Dix jours à Bali, rythme tranquille, on part du sud et on remonte vers Ubud.',
  'femmes', 4::smallint, null, null, 18::smallint, 35::smallint, 'organisateur');

do $$
declare n int;
begin
  select count(*) into n from public.trip_publications
   where trip_id = 'cccc0001-0000-0000-0000-000000000001' and mixite = 'femmes';
  assert n = 1, 'La publication devrait exister';
end $$;

reset role; reset request.jwt.claims;

-- ---------------------------------------------------------------------------
-- La règle d'admission, cas par cas.
-- ---------------------------------------------------------------------------
do $$
declare motif text;
begin
  -- Sofia : femme, 30 ans. Elle passe.
  motif := public.motif_de_refus('cccc0001-0000-0000-0000-000000000001', 'bbbb0002-0000-0000-0000-000000000002');
  assert motif is null, format('Sofia devrait pouvoir entrer, refus : %s', motif);

  -- Karim : homme, sur un voyage réservé aux femmes.
  motif := public.motif_de_refus('cccc0001-0000-0000-0000-000000000001', 'bbbb0003-0000-0000-0000-000000000003');
  assert motif = 'reserve-aux-femmes', format('Karim devrait être écarté, obtenu : %s', motif);

  -- La « jeune » : femme, mais treize ans sur un voyage 18-35.
  motif := public.motif_de_refus('cccc0001-0000-0000-0000-000000000001', 'bbbb0006-0000-0000-0000-000000000006');
  assert motif = 'trop-jeune', format('L''âge devrait écarter, obtenu : %s', motif);

  -- « Discret » n'a rien déclaré : on ne peut pas garantir une règle qu'on
  -- n'est pas en mesure de vérifier, donc on n'entre pas.
  motif := public.motif_de_refus('cccc0001-0000-0000-0000-000000000001', 'bbbb0007-0000-0000-0000-000000000007');
  assert motif = 'reserve-aux-femmes', format('Sans genre déclaré, le refus est attendu, obtenu : %s', motif);

  -- Léa est déjà membre : son propre voyage.
  motif := public.motif_de_refus('cccc0001-0000-0000-0000-000000000001', 'bbbb0001-0000-0000-0000-000000000001');
  assert motif = 'deja-membre', format('Obtenu : %s', motif);
end $$;

-- ---------------------------------------------------------------------------
-- Karim tente de forcer la porte en écrivant directement dans trip_members.
-- C'est l'attaque qui compte : l'écran ne le laisserait pas faire, PostgREST
-- avec la clé publique, si.
-- ---------------------------------------------------------------------------
set role authenticated;
set request.jwt.claims = '{"sub":"bbbb0003-0000-0000-0000-000000000003","role":"authenticated"}';

do $$
begin
  begin
    insert into public.trip_members (trip_id, user_id, role)
    values ('cccc0001-0000-0000-0000-000000000001', auth.uid(), 'member');
    raise exception 'FAILLE : Karim s''est inscrit de force à un voyage réservé aux femmes';
  exception
    when insufficient_privilege then null;
    when others then
      if sqlerrm like 'FAILLE%' then raise; end if;
  end;
end $$;

-- Et par la fonction, qui est la seule porte ouverte.
do $$
begin
  begin
    perform public.postuler_au_trip('cccc0001-0000-0000-0000-000000000001',
      'Bonjour, je serais très heureux de me joindre à votre voyage à Bali, je suis disponible.');
    raise exception 'FAILLE : la candidature de Karim aurait dû être refusée';
  exception when others then
    if sqlerrm like 'FAILLE%' then raise; end if;
    assert sqlerrm like '%reserve-aux-femmes%', format('Motif attendu, obtenu : %s', sqlerrm);
  end;
end $$;

-- Karim ne doit pas non plus voir le voyage dans sa recherche.
do $$
declare n int;
begin
  select count(*) into n from public.chercher_trips_ouverts('bali', array['ORY','PAR']);
  assert n = 0, format('Un voyage réservé aux femmes ne devrait pas apparaître (%s trouvé(s))', n);
end $$;

reset role; reset request.jwt.claims;

-- ---------------------------------------------------------------------------
-- Sofia postule dans les règles, Léa accepte.
-- ---------------------------------------------------------------------------
set role authenticated;
set request.jwt.claims = '{"sub":"bbbb0002-0000-0000-0000-000000000002","role":"authenticated"}';

do $$
declare suite text; n int;
begin
  -- Une présentation trop courte est refusée : c'est le minimum demandé.
  begin
    perform public.postuler_au_trip('cccc0001-0000-0000-0000-000000000001', 'Salut !');
    raise exception 'FAILLE : une présentation de sept caractères est passée';
  exception when others then
    if sqlerrm like 'FAILLE%' then raise; end if;
  end;

  suite := public.postuler_au_trip('cccc0001-0000-0000-0000-000000000001',
    'Bonjour Léa, j''ai vingt-neuf ans, je pars souvent seule et je cherche justement du monde pour Bali en octobre.');
  assert suite = 'en-attente', format('Validation manuelle attendue, obtenu : %s', suite);

  -- Postuler deux fois ne crée pas deux dossiers.
  begin
    perform public.postuler_au_trip('cccc0001-0000-0000-0000-000000000001',
      'Bonjour Léa, j''ai vingt-neuf ans, je pars souvent seule et je cherche justement du monde pour Bali en octobre.');
    raise exception 'FAILLE : deux candidatures pour la même personne';
  exception when others then
    if sqlerrm like 'FAILLE%' then raise; end if;
    assert sqlerrm like '%deja-candidat%', format('Obtenu : %s', sqlerrm);
  end;

  -- Tant qu'elle n'est pas acceptée, Sofia ne voit pas le voyage.
  select count(*) into n from public.trips where id = 'cccc0001-0000-0000-0000-000000000001';
  assert n = 0, 'Une candidate ne doit pas encore voir le voyage lui-même';
end $$;

reset role; reset request.jwt.claims;

set role authenticated;
set request.jwt.claims = '{"sub":"bbbb0001-0000-0000-0000-000000000001","role":"authenticated"}';

do $$
declare suite text; n int;
begin
  select count(*) into n from public.candidatures_recues('cccc0001-0000-0000-0000-000000000001');
  assert n = 1, format('Léa devrait voir une candidature (%s)', n);

  suite := public.trancher_la_candidature('cccc0001-0000-0000-0000-000000000001',
                                          'bbbb0002-0000-0000-0000-000000000002', true);
  assert suite = 'acceptee', format('Obtenu : %s', suite);

  select count(*) into n from public.trip_members
   where trip_id = 'cccc0001-0000-0000-0000-000000000001';
  assert n = 2, format('Deux membres attendus, %s', n);
end $$;

reset role; reset request.jwt.claims;

-- Une fois acceptée, Sofia voit le voyage.
set role authenticated;
set request.jwt.claims = '{"sub":"bbbb0002-0000-0000-0000-000000000002","role":"authenticated"}';
do $$
declare n int;
begin
  select count(*) into n from public.trips where id = 'cccc0001-0000-0000-0000-000000000001';
  assert n = 1, 'Une fois acceptée, la candidate voit le voyage';
end $$;
reset role; reset request.jwt.claims;

-- ---------------------------------------------------------------------------
-- Les quotas : un voyage mixte 2 femmes / 2 hommes reste mixte jusqu'au bout.
-- ---------------------------------------------------------------------------
set role authenticated;
set request.jwt.claims = '{"sub":"bbbb0003-0000-0000-0000-000000000003","role":"authenticated"}';

insert into public.trips (id, owner_id, title, origin_name, origin_lat, origin_lng, origin_iata,
                          destination_locked_id, destination_mode, duration_days)
values ('cccc0002-0000-0000-0000-000000000002', auth.uid(), 'Bali, groupe mixte',
        'Paris-Charles-de-Gaulle', 49.0097, 2.5479, array['CDG','PAR'], 'bali', 'fixed', 10);

select public.publier_le_trip(
  'cccc0002-0000-0000-0000-000000000002',
  'Dix jours à Bali, groupe mixte, on veut rester à peu près équilibrés.',
  'mixte', 4::smallint, 2::smallint, 2::smallint, null, null, 'auto');

reset role; reset request.jwt.claims;

-- Mehdi entre : deuxième homme, le quota d'hommes est atteint.
set role authenticated;
set request.jwt.claims = '{"sub":"bbbb0005-0000-0000-0000-000000000005","role":"authenticated"}';
do $$
declare suite text;
begin
  suite := public.postuler_au_trip('cccc0002-0000-0000-0000-000000000002',
    'Salut, trente ans, je pars en octobre et Bali me tente depuis longtemps, je suis plutôt tranquille.');
  assert suite = 'acceptee', format('Validation automatique attendue, obtenu : %s', suite);
end $$;
reset role; reset request.jwt.claims;

-- Un troisième homme doit être écarté par le quota, alors qu'il reste deux
-- places : ces places-là sont réservées aux femmes, c'est tout l'intérêt.
insert into auth.users (id, email, raw_user_meta_data)
values ('bbbb0008-0000-0000-0000-000000000008', 'yanis@example.test', '{"full_name":"Yanis"}');
update public.profiles set genre = 'homme', annee_naissance = 1997 where id = 'bbbb0008-0000-0000-0000-000000000008';

do $$
declare motif text; n int;
begin
  select count(*) into n from public.trip_members where trip_id = 'cccc0002-0000-0000-0000-000000000002';
  assert n = 2, format('Deux membres attendus, %s', n);

  motif := public.motif_de_refus('cccc0002-0000-0000-0000-000000000002', 'bbbb0008-0000-0000-0000-000000000008');
  assert motif = 'quota-hommes-atteint', format('Le quota devrait écarter le troisième homme, obtenu : %s', motif);

  -- Une femme, elle, entre : il reste deux places pour elles.
  motif := public.motif_de_refus('cccc0002-0000-0000-0000-000000000002', 'bbbb0004-0000-0000-0000-000000000004');
  assert motif is null, format('Inès devrait pouvoir entrer, refus : %s', motif);
end $$;

-- ---------------------------------------------------------------------------
-- L'appariement : même destination ET même point de départ.
-- ---------------------------------------------------------------------------
set role authenticated;
set request.jwt.claims = '{"sub":"bbbb0004-0000-0000-0000-000000000004","role":"authenticated"}';

do $$
declare n int;
begin
  -- Inès part d'Orly : le code de ville PAR la fait tomber sur les deux
  -- voyages parisiens, celui de Roissy compris.
  select count(*) into n from public.chercher_trips_ouverts('bali', array['ORY','PAR']);
  assert n = 2, format('Deux voyages parisiens attendus, %s trouvé(s)', n);

  -- Depuis Lyon, aucun : le voyage ne se partage que si on prend le même avion.
  select count(*) into n from public.chercher_trips_ouverts('bali', array['LYS']);
  assert n = 0, format('Aucun voyage lyonnais attendu, %s trouvé(s)', n);

  -- Même départ mais autre destination : rien non plus.
  select count(*) into n from public.chercher_trips_ouverts('lisbonne', array['ORY','PAR']);
  assert n = 0, format('Aucun voyage vers Lisbonne attendu, %s trouvé(s)', n);
end $$;

reset role; reset request.jwt.claims;

-- ---------------------------------------------------------------------------
-- L'exclusion ferme la porte, et elle la ferme pour de bon.
-- ---------------------------------------------------------------------------
set role authenticated;
set request.jwt.claims = '{"sub":"bbbb0003-0000-0000-0000-000000000003","role":"authenticated"}';

select public.exclure_du_trip('cccc0002-0000-0000-0000-000000000002',
                              'bbbb0005-0000-0000-0000-000000000005', 'Ne répond plus');

do $$
declare motif text; n int;
begin
  select count(*) into n from public.trip_members
   where trip_id = 'cccc0002-0000-0000-0000-000000000002'
     and user_id = 'bbbb0005-0000-0000-0000-000000000005';
  assert n = 0, 'L''exclusion devrait sortir la personne du voyage';
end $$;

-- On ne s'exclut pas soi-même de son propre voyage.
do $$
begin
  begin
    perform public.exclure_du_trip('cccc0002-0000-0000-0000-000000000002', auth.uid());
    raise exception 'FAILLE : l''organisateur s''est exclu lui-même';
  exception when others then
    if sqlerrm like 'FAILLE%' then raise; end if;
  end;
end $$;

reset role; reset request.jwt.claims;

do $$
declare motif text;
begin
  motif := public.motif_de_refus('cccc0002-0000-0000-0000-000000000002', 'bbbb0005-0000-0000-0000-000000000005');
  assert motif = 'exclu', format('Obtenu : %s', motif);
end $$;

-- Mehdi, exclu, ne peut plus revenir.
set role authenticated;
set request.jwt.claims = '{"sub":"bbbb0005-0000-0000-0000-000000000005","role":"authenticated"}';
do $$
begin
  begin
    perform public.postuler_au_trip('cccc0002-0000-0000-0000-000000000002',
      'Bonjour, je reviens vers vous, je serais toujours partant pour ce voyage à Bali en octobre.');
    raise exception 'FAILLE : une personne exclue a pu re-postuler';
  exception when others then
    if sqlerrm like 'FAILLE%' then raise; end if;
    assert sqlerrm like '%exclu%', format('Obtenu : %s', sqlerrm);
  end;
end $$;
reset role; reset request.jwt.claims;

-- ---------------------------------------------------------------------------
-- Personne d'autre que l'organisateur ne publie, ne tranche ni n'exclut.
-- ---------------------------------------------------------------------------
set role authenticated;
set request.jwt.claims = '{"sub":"bbbb0004-0000-0000-0000-000000000004","role":"authenticated"}';
do $$
begin
  begin
    perform public.publier_le_trip('cccc0002-0000-0000-0000-000000000002',
      'Je republie le voyage de quelqu''un d''autre, pour voir si ça passe.',
      'femmes', 10::smallint);
    raise exception 'FAILLE : une non-organisatrice a republié le voyage';
  exception when others then
    if sqlerrm like 'FAILLE%' then raise; end if;
  end;

  begin
    perform public.trancher_la_candidature('cccc0002-0000-0000-0000-000000000002',
                                           'bbbb0008-0000-0000-0000-000000000008', true);
    raise exception 'FAILLE : une non-organisatrice a accepté quelqu''un';
  exception when others then
    if sqlerrm like 'FAILLE%' then raise; end if;
  end;

  begin
    perform public.exclure_du_trip('cccc0002-0000-0000-0000-000000000002',
                                   'bbbb0003-0000-0000-0000-000000000003');
    raise exception 'FAILLE : une non-organisatrice a exclu l''organisateur';
  exception when others then
    if sqlerrm like 'FAILLE%' then raise; end if;
  end;

  -- Et la vue publique n'est pas lisible en direct : sinon l'annuaire complet
  -- des trips ouverts serait à portée d'un select, filtre d'appariement inclus.
  begin
    perform 1 from public.trips_ouverts;
    raise exception 'FAILLE : la vue des trips ouverts est lisible directement';
  exception
    when insufficient_privilege then null;
    when others then if sqlerrm like 'FAILLE%' then raise; end if;
  end;
end $$;
reset role; reset request.jwt.claims;

-- ---------------------------------------------------------------------------
-- Refermer : les candidatures en attente ne restent pas en suspens.
-- ---------------------------------------------------------------------------
set role authenticated;
set request.jwt.claims = '{"sub":"bbbb0004-0000-0000-0000-000000000004","role":"authenticated"}';
select public.postuler_au_trip('cccc0001-0000-0000-0000-000000000001',
  'Bonjour, je serais ravie de me joindre à vous pour ce voyage à Bali au mois d''octobre prochain.');
reset role; reset request.jwt.claims;

set role authenticated;
set request.jwt.claims = '{"sub":"bbbb0001-0000-0000-0000-000000000001","role":"authenticated"}';
select public.refermer_le_trip('cccc0001-0000-0000-0000-000000000001');
reset role; reset request.jwt.claims;

do $$
declare n int;
begin
  select count(*) into n from public.trip_candidatures
   where trip_id = 'cccc0001-0000-0000-0000-000000000001' and suite = 'en-attente';
  assert n = 0, format('Refermer devrait trancher les candidatures en attente (%s restante(s))', n);
end $$;

select '✅ Tous les tests des trips ouverts sont passés' as resultat;
