-- ============================================================================
-- Tests du coffre du voyage (infos partagées).
--
-- S'appuie sur l'état laissé par rls_test.sql : le voyage aaaaaaaa-…-0002
-- d'Abdel (organisateur), dont Thomas est membre et l'intrus non.
-- ============================================================================

\set ON_ERROR_STOP on
\timing off

-- Thomas range le code de la boîte à clés et le wifi.
set role authenticated;
set request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
do $$
begin
  insert into public.infos_du_voyage (id, trip_id, genre, titre, valeur, complement)
  values ('71000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000002',
          'code', 'Boîte à clés', '4521B', 'À droite de la porte');
  -- Un wifi ouvert : pas de mot de passe, et c'est permis.
  insert into public.infos_du_voyage (id, trip_id, genre, titre, valeur)
  values ('71000000-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000002',
          'wifi', 'Casa-Rosa', '');

  -- Un code vide, lui, ne sert à rien.
  begin
    insert into public.infos_du_voyage (trip_id, genre, titre, valeur)
    values ('aaaaaaaa-0000-0000-0000-000000000002', 'code', 'Porte', '  ');
    assert false, 'Un code vide a été accepté';
  exception when check_violation then null;
  end;

  -- Un genre inconnu : refusé.
  begin
    insert into public.infos_du_voyage (trip_id, genre, titre, valeur)
    values ('aaaaaaaa-0000-0000-0000-000000000002', 'mot-de-passe-bancaire', 'x', 'y');
    assert false, 'Un genre inconnu a été accepté';
  exception when check_violation then null;
  end;

  -- Au nom d'un autre : refusé.
  begin
    insert into public.infos_du_voyage (trip_id, genre, titre, valeur, cree_par)
    values ('aaaaaaaa-0000-0000-0000-000000000002', 'note', 'x', 'y', '11111111-1111-1111-1111-111111111111');
    assert false, 'FAILLE : Thomas a pu ajouter une info au nom d''Abdel';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
reset request.jwt.claims;

-- Abdel corrige le code ; ni l'auteur ni le voyage ne bougent.
set role authenticated;
set request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
do $$
declare n int;
begin
  update public.infos_du_voyage
     set valeur = '4521C', cree_par = '11111111-1111-1111-1111-111111111111',
         trip_id = 'aaaaaaaa-0000-0000-0000-000000000001'
   where id = '71000000-0000-0000-0000-000000000001';
  select count(*) into n from public.infos_du_voyage
   where id = '71000000-0000-0000-0000-000000000001' and valeur = '4521C'
     and cree_par = '22222222-2222-2222-2222-222222222222'
     and trip_id = 'aaaaaaaa-0000-0000-0000-000000000002';
  assert n = 1, 'Le code doit être corrigé, sans changer d''auteur ni de voyage';

  insert into public.infos_du_voyage (id, trip_id, genre, titre, valeur)
  values ('71000000-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000002',
          'contact', 'Maria', '+351 912 345 678');
end $$;
reset role;
reset request.jwt.claims;

-- L'intrus : rien à lire, rien à corriger, rien à ajouter, rien à retirer.
set role authenticated;
set request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';
do $$
declare n int;
begin
  select count(*) into n from public.infos_du_voyage;
  assert n = 0, format('FUITE : l''intrus voit %s info(s) du coffre', n);
  update public.infos_du_voyage set valeur = '0000';
  get diagnostics n = row_count;
  assert n = 0, 'FAILLE : l''intrus a pu changer un code';
  delete from public.infos_du_voyage;
  get diagnostics n = row_count;
  assert n = 0, 'FAILLE : l''intrus a pu vider le coffre';
  begin
    insert into public.infos_du_voyage (trip_id, genre, titre, valeur)
    values ('aaaaaaaa-0000-0000-0000-000000000002', 'note', 'Intrusion', 'x');
    assert false, 'FAILLE : l''intrus a pu écrire dans le coffre';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
reset request.jwt.claims;

-- Thomas ne retire pas le contact d'Abdel ; il retire son wifi.
set role authenticated;
set request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
do $$
declare n int;
begin
  delete from public.infos_du_voyage where id = '71000000-0000-0000-0000-000000000003';
  get diagnostics n = row_count;
  assert n = 0, 'FAILLE : Thomas a pu retirer l''info d''Abdel';
  delete from public.infos_du_voyage where id = '71000000-0000-0000-0000-000000000002';
  get diagnostics n = row_count;
  assert n = 1, format('Thomas doit pouvoir retirer son info (%s)', n);
end $$;
reset role;
reset request.jwt.claims;

-- L'organisateur retire ce qu'il veut.
set role authenticated;
set request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
do $$
declare n int;
begin
  delete from public.infos_du_voyage where id = '71000000-0000-0000-0000-000000000001';
  get diagnostics n = row_count;
  assert n = 1, format('L''organisateur doit pouvoir retirer une info (%s)', n);
end $$;
reset role;
reset request.jwt.claims;

select '✅ Tests du coffre passés' as resultat;
