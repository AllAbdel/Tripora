-- ============================================================================
-- Tests de « Qui fait quoi ».
--
-- S'appuie sur l'état laissé par rls_test.sql : le voyage aaaaaaaa-…-0002
-- d'Abdel (organisateur), dont Thomas est membre et l'intrus non.
-- ============================================================================

\set ON_ERROR_STOP on
\timing off

-- Thomas ajoute une tâche et la confie à Abdel.
set role authenticated;
set request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
do $$
declare n int;
begin
  insert into public.taches (id, trip_id, titre, responsable, echeance)
  values ('70000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000002',
          'Réserver la voiture', '11111111-1111-1111-1111-111111111111', '2026-10-01');

  -- Cochée à la création au nom d'un autre : la base note qui l'a vraiment fait.
  insert into public.taches (id, trip_id, titre, faite, faite_par)
  values ('70000000-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000002',
          'Prendre l''assurance', true, '11111111-1111-1111-1111-111111111111');
  select count(*) into n from public.taches
   where id = '70000000-0000-0000-0000-000000000002'
     and faite_par = '22222222-2222-2222-2222-222222222222' and faite_le is not null;
  assert n = 1, 'FAILLE : « faite par » a pu être attribué à un autre';

  -- Confier une tâche à quelqu'un qui n'est pas du voyage : refusé.
  begin
    insert into public.taches (trip_id, titre, responsable)
    values ('aaaaaaaa-0000-0000-0000-000000000002', 'Piège', '33333333-3333-3333-3333-333333333333');
    assert false, 'FAILLE : une tâche a été confiée à un non-membre';
  exception when check_violation then null;
  end;

  -- Au nom d'un autre : refusé.
  begin
    insert into public.taches (trip_id, titre, cree_par)
    values ('aaaaaaaa-0000-0000-0000-000000000002', 'Au nom d''Abdel', '11111111-1111-1111-1111-111111111111');
    assert false, 'FAILLE : Thomas a pu ajouter une tâche au nom d''Abdel';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
reset request.jwt.claims;

-- Abdel coche la sienne ; il ne peut ni changer l'auteur ni le voyage.
set role authenticated;
set request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
do $$
declare n int;
begin
  update public.taches set faite = true, cree_par = '11111111-1111-1111-1111-111111111111',
         trip_id = 'aaaaaaaa-0000-0000-0000-000000000001'
   where id = '70000000-0000-0000-0000-000000000001';
  select count(*) into n from public.taches
   where id = '70000000-0000-0000-0000-000000000001'
     and faite and faite_par = '11111111-1111-1111-1111-111111111111'
     and cree_par = '22222222-2222-2222-2222-222222222222'
     and trip_id = 'aaaaaaaa-0000-0000-0000-000000000002';
  assert n = 1, 'La tâche doit être cochée par Abdel, sans changer d''auteur ni de voyage';

  -- Décochée : plus personne ne l'a faite.
  update public.taches set faite = false where id = '70000000-0000-0000-0000-000000000001';
  select count(*) into n from public.taches
   where id = '70000000-0000-0000-0000-000000000001' and faite_par is null and faite_le is null;
  assert n = 1, 'Une tâche décochée ne doit plus avoir d''auteur de la coche';
end $$;
reset role;
reset request.jwt.claims;

-- L'intrus : rien à voir, rien à cocher, rien à ajouter.
set role authenticated;
set request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';
do $$
declare n int;
begin
  select count(*) into n from public.taches;
  assert n = 0, format('FUITE : l''intrus voit %s tâche(s)', n);
  update public.taches set faite = true;
  get diagnostics n = row_count;
  assert n = 0, 'FAILLE : l''intrus a pu cocher une tâche';
  begin
    insert into public.taches (trip_id, titre) values ('aaaaaaaa-0000-0000-0000-000000000002', 'Intrusion');
    assert false, 'FAILLE : l''intrus a pu ajouter une tâche';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
reset request.jwt.claims;

-- Thomas ne retire pas la tâche qu'il n'a pas créée ; il retire la sienne.
set role authenticated;
set request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
do $$
declare n int;
begin
  insert into public.taches (id, trip_id, titre)
  values ('70000000-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000002', 'Tâche d''essai');
end $$;
reset role;
reset request.jwt.claims;

set role authenticated;
set request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
do $$
declare n int;
begin
  insert into public.taches (id, trip_id, titre)
  values ('70000000-0000-0000-0000-000000000004', 'aaaaaaaa-0000-0000-0000-000000000002', 'Celle d''Abdel');
end $$;
reset role;
reset request.jwt.claims;

set role authenticated;
set request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
do $$
declare n int;
begin
  delete from public.taches where id = '70000000-0000-0000-0000-000000000004';
  get diagnostics n = row_count;
  assert n = 0, 'FAILLE : Thomas a pu retirer la tâche d''Abdel';
  delete from public.taches where id = '70000000-0000-0000-0000-000000000003';
  get diagnostics n = row_count;
  assert n = 1, format('Thomas doit pouvoir retirer sa tâche (%s)', n);
end $$;
reset role;
reset request.jwt.claims;

select '✅ Tests de « Qui fait quoi » passés' as resultat;
