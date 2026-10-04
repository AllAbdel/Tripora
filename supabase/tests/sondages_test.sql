-- ============================================================================
-- Tests des sondages du groupe.
--
-- S'appuie sur l'état laissé par rls_test.sql : le voyage
-- aaaaaaaa-…-0002 d'Abdel (organisateur), dont Thomas est membre et dont
-- l'intrus n'est pas.
-- ============================================================================

\set ON_ERROR_STOP on
\timing off

-- Thomas lance un sondage de dates, à choix unique.
set role authenticated;
set request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
do $$
declare n int;
begin
  insert into public.sondages (id, trip_id, question, genre)
  values ('50000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000002',
          'Quelles dates ?', 'dates');

  -- Le voyage de l'option est pris sur le sondage, quoi qu'on envoie.
  insert into public.sondage_options (id, sondage_id, trip_id, libelle, du, au, position)
  values ('51000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001',
          'aaaaaaaa-0000-0000-0000-000000000001', 'Premier week-end', '2026-10-09', '2026-10-11', 0),
         ('51000000-0000-0000-0000-000000000002', '50000000-0000-0000-0000-000000000001',
          null, 'Second week-end', '2026-10-16', '2026-10-18', 1);
  select count(*) into n from public.sondage_options
   where sondage_id = '50000000-0000-0000-0000-000000000001'
     and trip_id = 'aaaaaaaa-0000-0000-0000-000000000002';
  assert n = 2, format('Les options doivent appartenir au voyage du sondage (%s)', n);

  -- Des dates à l'envers : refusées.
  begin
    insert into public.sondage_options (sondage_id, libelle, du, au)
    values ('50000000-0000-0000-0000-000000000001', 'À l''envers', '2026-10-20', '2026-10-18');
    assert false, 'Des dates à l''envers ont été acceptées';
  exception when check_violation then null;
  end;

  -- Un lien qui n'est pas en https : refusé.
  begin
    insert into public.sondage_options (sondage_id, libelle, lien)
    values ('50000000-0000-0000-0000-000000000001', 'Piège', 'javascript:alert(1)');
    assert false, 'FAILLE : un lien non https a été accepté';
  exception when check_violation then null;
  end;

  -- Choix unique : voter pour la seconde option déplace le vote.
  insert into public.sondage_votes (option_id) values ('51000000-0000-0000-0000-000000000001');
  insert into public.sondage_votes (option_id) values ('51000000-0000-0000-0000-000000000002');
  select count(*) into n from public.sondage_votes
   where sondage_id = '50000000-0000-0000-0000-000000000001'
     and user_id = '22222222-2222-2222-2222-222222222222';
  assert n = 1, format('À choix unique, un seul vote par personne (%s)', n);

  -- Au nom d'un autre : refusé.
  begin
    insert into public.sondage_votes (option_id, user_id)
    values ('51000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111');
    assert false, 'FAILLE : Thomas a pu voter au nom d''Abdel';
  exception when insufficient_privilege then null;
  end;

  -- Réassigner son sondage à un autre voyage ou un autre auteur : sans effet.
  update public.sondages
     set cree_par = '11111111-1111-1111-1111-111111111111',
         trip_id = 'aaaaaaaa-0000-0000-0000-000000000001'
   where id = '50000000-0000-0000-0000-000000000001';
  select count(*) into n from public.sondages
   where id = '50000000-0000-0000-0000-000000000001'
     and cree_par = '22222222-2222-2222-2222-222222222222'
     and trip_id = 'aaaaaaaa-0000-0000-0000-000000000002';
  assert n = 1, 'FAILLE : l''auteur ou le voyage d''un sondage a pu être changé';
end $$;
reset role;
reset request.jwt.claims;

-- Abdel, l'organisateur, vote, propose une option, et clôt.
set role authenticated;
set request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
do $$
declare n int;
begin
  insert into public.sondage_votes (option_id) values ('51000000-0000-0000-0000-000000000002');
  select count(*) into n from public.sondage_votes where option_id = '51000000-0000-0000-0000-000000000002';
  assert n = 2, format('Deux votes attendus sur le second week-end (%s)', n);

  insert into public.sondage_options (id, sondage_id, libelle, du, au)
  values ('51000000-0000-0000-0000-000000000003', '50000000-0000-0000-0000-000000000001',
          'Pont de la Toussaint', '2026-10-30', '2026-11-02');

  -- Le vote de Thomas ne se retire pas à sa place.
  delete from public.sondage_votes
   where user_id = '22222222-2222-2222-2222-222222222222';
  get diagnostics n = row_count;
  assert n = 0, 'FAILLE : Abdel a pu retirer le vote de Thomas';

  update public.sondages set clos = true where id = '50000000-0000-0000-0000-000000000001';
  get diagnostics n = row_count;
  assert n = 1, format('L''organisateur doit pouvoir clore un sondage du groupe (%s)', n);
end $$;
reset role;
reset request.jwt.claims;

-- Sondage clos : plus de vote, plus de proposition, plus de retrait.
set role authenticated;
set request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
do $$
declare n int;
begin
  begin
    insert into public.sondage_votes (option_id) values ('51000000-0000-0000-0000-000000000003');
    assert false, 'Un vote a été accepté dans un sondage clos';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.sondage_options (sondage_id, libelle) values ('50000000-0000-0000-0000-000000000001', 'Trop tard');
    assert false, 'Une option a été ajoutée à un sondage clos';
  exception when insufficient_privilege then null;
  end;
  delete from public.sondage_votes where user_id = '22222222-2222-2222-2222-222222222222';
  get diagnostics n = row_count;
  assert n = 0, 'Un vote a été retiré d''un sondage clos';

  -- L'auteur du sondage fait le ménage dans son sondage, même clos : il retire
  -- l'option qu'Abdel y avait ajoutée.
  delete from public.sondage_options where id = '51000000-0000-0000-0000-000000000003';
  get diagnostics n = row_count;
  assert n = 1, format('L''auteur du sondage doit pouvoir retirer une option (%s)', n);
end $$;
reset role;
reset request.jwt.claims;

-- L'intrus ne voit rien, ne vote pas, ne lance rien.
set role authenticated;
set request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';
do $$
declare n int;
begin
  select count(*) into n from public.sondages;
  assert n = 0, format('FUITE : l''intrus voit %s sondage(s)', n);
  select count(*) into n from public.sondage_options;
  assert n = 0, format('FUITE : l''intrus voit %s option(s)', n);
  select count(*) into n from public.sondage_votes;
  assert n = 0, format('FUITE : l''intrus voit %s vote(s)', n);

  begin
    insert into public.sondages (trip_id, question)
    values ('aaaaaaaa-0000-0000-0000-000000000002', 'Intrusion ?');
    assert false, 'FAILLE : l''intrus a pu lancer un sondage';
  exception when insufficient_privilege then null;
  end;
  -- Voter sur une option qu'il ne peut pas lire : l'option n'existe pas pour lui.
  begin
    insert into public.sondage_votes (option_id) values ('51000000-0000-0000-0000-000000000001');
    assert false, 'FAILLE : l''intrus a pu voter';
  exception when not_null_violation or insufficient_privilege then null;
  end;
  update public.sondages set clos = false;
  get diagnostics n = row_count;
  assert n = 0, 'FAILLE : l''intrus a pu rouvrir un sondage';
end $$;
reset role;
reset request.jwt.claims;

-- Retirer le sondage emporte ses options et ses votes.
set role authenticated;
set request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
do $$
declare n int;
begin
  delete from public.sondages where id = '50000000-0000-0000-0000-000000000001';
  get diagnostics n = row_count;
  assert n = 1, format('L''auteur doit pouvoir retirer son sondage (%s)', n);
  select count(*) into n from public.sondage_options where sondage_id = '50000000-0000-0000-0000-000000000001';
  assert n = 0, 'Les options d''un sondage retiré sont restées';
end $$;
reset role;
reset request.jwt.claims;

select '✅ Tests des sondages passés' as resultat;
