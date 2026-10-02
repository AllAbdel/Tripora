-- ============================================================================
-- Tests du journal photo : les fiches, les fichiers et les quotas.
--
-- S'appuie sur l'état laissé par rls_test.sql : le voyage aaaaaaaa-…-0002
-- d'Abdel (organisateur), dont Thomas est membre et l'intrus non.
-- ============================================================================

\set ON_ERROR_STOP on
\timing off

-- Thomas dépose une photo et sa vignette, puis sa fiche.
set role authenticated;
set request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
do $$
declare n int;
begin
  insert into storage.objects (bucket_id, name, metadata)
  values ('journal', 'aaaaaaaa-0000-0000-0000-000000000002/p1.jpg', '{"size": 300000, "mimetype": "image/jpeg"}'),
         ('journal', 'aaaaaaaa-0000-0000-0000-000000000002/p1.mini.jpg', '{"size": 30000, "mimetype": "image/jpeg"}');

  -- Hors d'un voyage dont il est membre : refusé.
  begin
    insert into storage.objects (bucket_id, name, metadata)
    values ('journal', 'aaaaaaaa-0000-0000-0000-000000000001/p.jpg', '{"size": 10}');
    assert false, 'FAILLE : Thomas a déposé une photo dans un voyage dont il n''est pas';
  exception when insufficient_privilege then null;
  end;

  -- La taille vient du stockage ; une date de prise de vue future est oubliée.
  insert into public.photos_du_voyage (id, trip_id, chemin, chemin_mini, legende, prise_le, largeur, hauteur, taille)
  values ('73000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000002',
          'aaaaaaaa-0000-0000-0000-000000000002/p1.jpg', 'aaaaaaaa-0000-0000-0000-000000000002/p1.mini.jpg',
          'Coucher de soleil', now() + interval '3 years', 1600, 1200, 1);
  select count(*) into n from public.photos_du_voyage
   where id = '73000000-0000-0000-0000-000000000001'
     and taille = 300000 and prise_le is null and ajoute_par = '22222222-2222-2222-2222-222222222222';
  assert n = 1, 'La taille doit venir du fichier, et une date future être oubliée';

  -- Une fiche dont la vignette manque : refusée.
  insert into storage.objects (bucket_id, name, metadata)
  values ('journal', 'aaaaaaaa-0000-0000-0000-000000000002/p2.jpg', '{"size": 200000}');
  begin
    insert into public.photos_du_voyage (trip_id, chemin, chemin_mini)
    values ('aaaaaaaa-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000002/p2.jpg',
            'aaaaaaaa-0000-0000-0000-000000000002/p2.mini.jpg');
    assert false, 'Une fiche sans vignette a été acceptée';
  exception when check_violation then null;
  end;
end $$;
reset role;
reset request.jwt.claims;

-- Abdel, l'organisateur : il voit la photo de Thomas, ne change pas sa
-- légende, et ne peut pas en ficher les fichiers à son nom.
set role authenticated;
set request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
do $$
declare n int;
begin
  select count(*) into n from public.photos_du_voyage where trip_id = 'aaaaaaaa-0000-0000-0000-000000000002';
  assert n = 1, format('Abdel doit voir la photo de Thomas (%s)', n);
  select count(*) into n from storage.objects
   where bucket_id = 'journal' and name like 'aaaaaaaa-0000-0000-0000-000000000002/p1%';
  assert n = 2, 'Abdel doit pouvoir lire la photo et sa vignette';

  update public.photos_du_voyage set legende = 'Réécrite par Abdel';
  get diagnostics n = row_count;
  assert n = 0, 'FAILLE : Abdel a réécrit la légende de Thomas';

  begin
    insert into public.photos_du_voyage (trip_id, chemin, chemin_mini)
    values ('aaaaaaaa-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000002/p2.jpg',
            'aaaaaaaa-0000-0000-0000-000000000002/p1.mini.jpg');
    assert false, 'FAILLE : Abdel a fiché les fichiers de Thomas';
  exception when check_violation then null;
  end;

  -- Sa photo à lui, qui restera pour le test de la purge.
  insert into storage.objects (bucket_id, name, metadata)
  values ('journal', 'aaaaaaaa-0000-0000-0000-000000000002/a1.jpg', '{"size": 250000}'),
         ('journal', 'aaaaaaaa-0000-0000-0000-000000000002/a1.mini.jpg', '{"size": 25000}');
  insert into public.photos_du_voyage (trip_id, chemin, chemin_mini)
  values ('aaaaaaaa-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000002/a1.jpg',
          'aaaaaaaa-0000-0000-0000-000000000002/a1.mini.jpg');
end $$;
reset role;
reset request.jwt.claims;

-- Thomas change sa légende ; rien d'autre ne bouge.
set role authenticated;
set request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
do $$
declare n int;
begin
  update public.photos_du_voyage
     set legende = 'Plage de Balangan', chemin = 'aaaaaaaa-0000-0000-0000-000000000002/a1.jpg', taille = 1
   where id = '73000000-0000-0000-0000-000000000001';
  select count(*) into n from public.photos_du_voyage
   where id = '73000000-0000-0000-0000-000000000001' and legende = 'Plage de Balangan'
     and chemin = 'aaaaaaaa-0000-0000-0000-000000000002/p1.jpg' and taille = 300000;
  assert n = 1, 'Seule la légende doit changer';

  select count(*) into n from public.espace_du_journal() where utilise = 530000;
  assert n = 1, 'L''espace du journal doit compter les fichiers de Thomas';
end $$;
reset role;
reset request.jwt.claims;

-- L'intrus : rien à voir, rien à déposer, rien à retirer.
set role authenticated;
set request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';
do $$
declare n int;
begin
  select count(*) into n from public.photos_du_voyage;
  assert n = 0, format('FUITE : l''intrus voit %s photo(s)', n);
  select count(*) into n from storage.objects where bucket_id = 'journal';
  assert n = 0, format('FUITE : l''intrus voit %s fichier(s) du journal', n);
  delete from storage.objects where bucket_id = 'journal';
  get diagnostics n = row_count;
  assert n = 0, 'FAILLE : l''intrus a supprimé des photos';
  begin
    insert into storage.objects (bucket_id, name, metadata)
    values ('journal', 'aaaaaaaa-0000-0000-0000-000000000002/intrus.jpg', '{"size": 10}');
    assert false, 'FAILLE : l''intrus a déposé une photo';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
reset request.jwt.claims;

-- Le quota : au-delà de 80 Mo de photos, Thomas ne dépose plus rien.
set role authenticated;
set request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
do $$
begin
  insert into storage.objects (bucket_id, name, metadata)
  values ('journal', 'aaaaaaaa-0000-0000-0000-000000000002/lourde.jpg', '{"size": 90000000}');
  begin
    insert into storage.objects (bucket_id, name, metadata)
    values ('journal', 'aaaaaaaa-0000-0000-0000-000000000002/encore.jpg', '{"size": 10}');
    assert false, 'Le quota du journal n''a pas arrêté le dépôt';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
reset request.jwt.claims;

-- L'organisateur retire la photo de Thomas : les fichiers, puis la fiche.
set role authenticated;
set request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
do $$
declare n int;
begin
  delete from storage.objects
   where bucket_id = 'journal' and name in ('aaaaaaaa-0000-0000-0000-000000000002/p1.jpg',
                                            'aaaaaaaa-0000-0000-0000-000000000002/p1.mini.jpg');
  get diagnostics n = row_count;
  assert n = 2, format('L''organisateur doit pouvoir retirer les fichiers d''une photo (%s)', n);
  delete from public.photos_du_voyage where id = '73000000-0000-0000-0000-000000000001';
  get diagnostics n = row_count;
  assert n = 1, format('L''organisateur doit pouvoir retirer la fiche (%s)', n);
end $$;
reset role;
reset request.jwt.claims;

-- Ménage : la photo trop lourde fausserait les quotas des tests suivants.
delete from storage.objects where bucket_id = 'journal' and name like '%/lourde.jpg';
delete from storage.objects where bucket_id = 'journal' and name like '%/p2.jpg';

select '✅ Tests du journal photo passés' as resultat;
