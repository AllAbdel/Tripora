-- ============================================================================
-- Tests des votes secrets : le vote sur la destination, anonyme, et les
-- sondages à bulletin secret.
--
-- S'appuie sur l'état laissé par rls_test.sql : le voyage aaaaaaaa-…-0002
-- d'Abdel (organisateur), dont Thomas est membre et l'intrus non ; Abdel et
-- Thomas ont voté « j'aime » pour Barcelone.
-- ============================================================================

\set ON_ERROR_STOP on
\timing off

-- ---------------------------------------------------- Vote sur la destination

-- Thomas ne lit que son vote, mais les totaux disent tout ce qu'il faut.
set role authenticated;
set request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
do $$
declare n int; ligne record;
begin
  select count(*) into n from public.votes
   where trip_id = 'aaaaaaaa-0000-0000-0000-000000000002' and subject_type = 'proposal';
  assert n = 1, format('Thomas ne doit lire que son vote sur la destination, il en lit %s', n);

  select * into ligne from public.votes_du_voyage('aaaaaaaa-0000-0000-0000-000000000002')
   where subject_id = 'barcelone';
  assert ligne.aime = 2 and ligne.prefere = 0 and ligne.contre = 0, format('Barcelone : 2 « j''aime » attendus (%s)', row_to_json(ligne));
  assert ligne.moi = 'like', 'Thomas doit retrouver son propre vote';
  assert ligne.votants = 2, format('2 votants attendus (%s)', ligne.votants);

  select count(*) into n from public.votes_modifies where trip_id = 'aaaaaaaa-0000-0000-0000-000000000002';
  assert n = 1, 'Le signal des votes doit exister et être lisible par les membres';
end $$;
reset role;
reset request.jwt.claims;

-- L'intrus : ni votes, ni totaux, ni signal.
set role authenticated;
set request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';
do $$
declare n int;
begin
  select count(*) into n from public.votes_du_voyage('aaaaaaaa-0000-0000-0000-000000000002');
  assert n = 0, format('FUITE : l''intrus obtient %s total(aux) de votes', n);
  select count(*) into n from public.votes_modifies;
  assert n = 0, 'FUITE : l''intrus voit le signal des votes';
  select count(*) into n from public.votes;
  assert n = 0, 'FUITE : l''intrus lit des votes';
end $$;
reset role;
reset request.jwt.claims;

-- ------------------------------------------------------------ Sondage secret

-- Thomas lance un vote secret, à choix unique, et vote pour la plage.
set role authenticated;
set request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
do $$
declare n int;
begin
  insert into public.sondages (id, trip_id, question, secret)
  values ('52000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000002', 'Plage ou montagne ?', true);
  insert into public.sondage_options (id, sondage_id, libelle, position)
  values ('53000000-0000-0000-0000-000000000001', '52000000-0000-0000-0000-000000000001', 'Plage', 0),
         ('53000000-0000-0000-0000-000000000002', '52000000-0000-0000-0000-000000000001', 'Montagne', 1);
  insert into public.sondage_votes (option_id) values ('53000000-0000-0000-0000-000000000001');

  select count(*) into n from public.sondage_votes
   where sondage_id = '52000000-0000-0000-0000-000000000001' and secret;
  assert n = 1, 'Le bulletin doit être marqué secret, recopié du sondage';
end $$;
reset role;
reset request.jwt.claims;

-- Abdel, l'organisateur, vote pour la montagne. Il ne voit pas le bulletin de
-- Thomas, ni les voix tant que le sondage est ouvert : seulement que deux
-- personnes ont voté.
set role authenticated;
set request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
do $$
declare n int; ligne record; signal timestamptz;
begin
  insert into public.sondage_votes (option_id) values ('53000000-0000-0000-0000-000000000002');

  select count(*) into n from public.sondage_votes where sondage_id = '52000000-0000-0000-0000-000000000001';
  assert n = 1, format('Abdel ne doit lire que son bulletin, il en lit %s', n);
  select count(*) into n from public.sondage_votes
   where sondage_id = '52000000-0000-0000-0000-000000000001' and user_id = '22222222-2222-2222-2222-222222222222';
  assert n = 0, 'FUITE : l''organisateur lit le bulletin secret de Thomas';

  for ligne in select * from public.decompte_des_sondages_secrets('aaaaaaaa-0000-0000-0000-000000000002') loop
    assert ligne.voix is null, format('FUITE : les voix d''un vote secret ouvert sont lisibles (%s)', row_to_json(ligne));
    assert ligne.votants = 2, format('2 votants attendus (%s)', row_to_json(ligne));
  end loop;
  select count(*) into n from public.decompte_des_sondages_secrets('aaaaaaaa-0000-0000-0000-000000000002');
  assert n = 2, format('Une ligne par option attendue, %s', n);

  -- Le signal a bougé, sans rien dire de plus.
  select derniere_voix into signal from public.sondages where id = '52000000-0000-0000-0000-000000000001';
  assert signal is not null, 'Le signal des votes doit être posé sur le sondage';

  -- Rendre public un sondage secret : sans effet.
  update public.sondages set secret = false where id = '52000000-0000-0000-0000-000000000001';
  select count(*) into n from public.sondages where id = '52000000-0000-0000-0000-000000000001' and secret;
  assert n = 1, 'FAILLE : un sondage secret a pu devenir public';

  -- Clore : les voix apparaissent, toujours sans les noms.
  update public.sondages set clos = true where id = '52000000-0000-0000-0000-000000000001';
  select voix into n from public.decompte_des_sondages_secrets('aaaaaaaa-0000-0000-0000-000000000002')
   where option_id = '53000000-0000-0000-0000-000000000001';
  assert n = 1, format('Une voix pour la plage attendue à la clôture, %s', n);
  select voix into n from public.decompte_des_sondages_secrets('aaaaaaaa-0000-0000-0000-000000000002')
   where option_id = '53000000-0000-0000-0000-000000000002';
  assert n = 1, format('Une voix pour la montagne attendue à la clôture, %s', n);
  select count(*) into n from public.sondage_votes where user_id = '22222222-2222-2222-2222-222222222222';
  assert n = 0, 'FUITE : la clôture dévoile le bulletin de Thomas';

  -- Et il ne se rouvre pas.
  begin
    update public.sondages set clos = false where id = '52000000-0000-0000-0000-000000000001';
    assert false, 'FAILLE : un vote secret clos a été rouvert';
  exception when sqlstate 'P0030' then null;
  end;
end $$;
reset role;
reset request.jwt.claims;

-- L'intrus n'obtient aucun décompte.
set role authenticated;
set request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';
do $$
declare n int;
begin
  select count(*) into n from public.decompte_des_sondages_secrets('aaaaaaaa-0000-0000-0000-000000000002');
  assert n = 0, format('FUITE : l''intrus obtient %s ligne(s) de décompte', n);
end $$;
reset role;
reset request.jwt.claims;

-- Les votes de sondage ne passent plus par le temps réel : retirer un
-- bulletin y aurait envoyé sa clé (option, personne) à tout le groupe.
do $$
declare n int;
begin
  select count(*) into n from pg_publication_tables
   where pubname = 'supabase_realtime' and tablename = 'sondage_votes';
  assert n = 0, 'FUITE : les votes de sondage sont encore diffusés en temps réel';
  select count(*) into n from pg_publication_tables
   where pubname = 'supabase_realtime' and tablename = 'votes_modifies';
  assert n = 1, 'Le signal des votes doit être diffusé en temps réel';
end $$;

-- Retirer le sondage secret emporte options et bulletins, signal compris.
set role authenticated;
set request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
do $$
declare n int;
begin
  delete from public.sondages where id = '52000000-0000-0000-0000-000000000001';
  get diagnostics n = row_count;
  assert n = 1, format('Thomas doit pouvoir retirer son sondage secret (%s)', n);
end $$;
reset role;
reset request.jwt.claims;

do $$
declare n int;
begin
  select count(*) into n from public.sondage_votes where sondage_id = '52000000-0000-0000-0000-000000000001';
  assert n = 0, 'Les bulletins d''un sondage retiré sont restés';
end $$;

select '✅ Tests des votes secrets passés' as resultat;
