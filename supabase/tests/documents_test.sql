-- ============================================================================
-- Tests des documents du coffre : les fiches, et les fichiers du stockage.
--
-- S'appuie sur l'état laissé par rls_test.sql : le voyage aaaaaaaa-…-0002
-- d'Abdel (organisateur), dont Thomas est membre et l'intrus non.
--
-- L'API de stockage de Supabase insère la ligne de l'objet au nom de la
-- personne connectée, sous ses politiques ; on fait de même ici.
-- ============================================================================

\set ON_ERROR_STOP on
\timing off

-- Thomas dépose deux fichiers dans le voyage : les billets, et son passeport.
set role authenticated;
set request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
do $$
declare n int;
begin
  insert into storage.objects (bucket_id, name, metadata)
  values ('documents', 'aaaaaaaa-0000-0000-0000-000000000002/billets.pdf',
          '{"size": 120000, "mimetype": "application/pdf"}');
  insert into storage.objects (bucket_id, name, metadata)
  values ('documents', 'aaaaaaaa-0000-0000-0000-000000000002/passeport.jpg',
          '{"size": 800000, "mimetype": "image/jpeg"}');

  -- Hors d'un dossier de voyage, ou dans un voyage dont il n'est pas : refusé.
  begin
    insert into storage.objects (bucket_id, name, metadata)
    values ('documents', 'en-vrac.pdf', '{"size": 10}');
    assert false, 'FAILLE : un fichier a été déposé hors d''un voyage';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into storage.objects (bucket_id, name, metadata)
    values ('documents', 'aaaaaaaa-0000-0000-0000-000000000001/intrus.pdf', '{"size": 10}');
    assert false, 'FAILLE : Thomas a déposé un fichier dans un voyage dont il n''est pas';
  exception when insufficient_privilege then null;
  end;

  -- La fiche : taille et type viennent du fichier, pas de ce qu'on déclare.
  insert into public.documents_du_voyage (id, trip_id, nom, chemin, taille, type_mime)
  values ('72000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000002',
          'Billets aller', 'aaaaaaaa-0000-0000-0000-000000000002/billets.pdf', 1, 'text/html');
  select count(*) into n from public.documents_du_voyage
   where id = '72000000-0000-0000-0000-000000000001'
     and taille = 120000 and type_mime = 'application/pdf'
     and ajoute_par = '22222222-2222-2222-2222-222222222222';
  assert n = 1, 'La taille et le type doivent venir du fichier';

  insert into public.documents_du_voyage (id, trip_id, nom, chemin, prive)
  values ('72000000-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000002',
          'Mon passeport', 'aaaaaaaa-0000-0000-0000-000000000002/passeport.jpg', true);

  -- Une fiche sans fichier, ou pour un fichier rangé ailleurs : refusée.
  begin
    insert into public.documents_du_voyage (trip_id, nom, chemin)
    values ('aaaaaaaa-0000-0000-0000-000000000002', 'Fantôme', 'aaaaaaaa-0000-0000-0000-000000000002/rien.pdf');
    assert false, 'Une fiche sans fichier a été acceptée';
  exception when check_violation then null;
  end;
end $$;
reset role;
reset request.jwt.claims;

-- Abdel dépose un fichier ; Thomas ne peut pas s'en attribuer la fiche.
set role authenticated;
set request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
do $$
begin
  insert into storage.objects (bucket_id, name, metadata)
  values ('documents', 'aaaaaaaa-0000-0000-0000-000000000002/hotel.pdf',
          '{"size": 50000, "mimetype": "application/pdf"}');
end $$;
reset role;
reset request.jwt.claims;

set role authenticated;
set request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
do $$
begin
  insert into public.documents_du_voyage (trip_id, nom, chemin)
  values ('aaaaaaaa-0000-0000-0000-000000000002', 'Pas à moi', 'aaaaaaaa-0000-0000-0000-000000000002/hotel.pdf');
  assert false, 'FAILLE : Thomas a pu ficher le fichier d''Abdel';
exception when check_violation then null;
end $$;
reset role;
reset request.jwt.claims;

-- Abdel voit les billets, pas le passeport de Thomas ; il ne renomme pas les
-- documents des autres.
set role authenticated;
set request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
do $$
declare n int;
begin
  select count(*) into n from public.documents_du_voyage;
  assert n = 1, format('Abdel doit voir 1 fiche (les billets), il en voit %s', n);
  select count(*) into n from storage.objects
   where bucket_id = 'documents' and name = 'aaaaaaaa-0000-0000-0000-000000000002/billets.pdf';
  assert n = 1, 'Abdel doit pouvoir lire les billets';
  select count(*) into n from storage.objects
   where bucket_id = 'documents' and name = 'aaaaaaaa-0000-0000-0000-000000000002/passeport.jpg';
  assert n = 0, 'FUITE : Abdel lit le passeport privé de Thomas';

  update public.documents_du_voyage set nom = 'Renommé par Abdel';
  get diagnostics n = row_count;
  assert n = 0, 'FAILLE : Abdel a renommé le document de Thomas';

  -- Sa fiche à lui.
  insert into public.documents_du_voyage (id, trip_id, nom, chemin)
  values ('72000000-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000002',
          'Hôtel', 'aaaaaaaa-0000-0000-0000-000000000002/hotel.pdf');
end $$;
reset role;
reset request.jwt.claims;

-- Thomas renomme ses billets ; le chemin, lui, ne bouge pas.
set role authenticated;
set request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
do $$
declare n int;
begin
  update public.documents_du_voyage
     set nom = 'Billets aller-retour', chemin = 'aaaaaaaa-0000-0000-0000-000000000002/hotel.pdf', taille = 1
   where id = '72000000-0000-0000-0000-000000000001';
  select count(*) into n from public.documents_du_voyage
   where id = '72000000-0000-0000-0000-000000000001' and nom = 'Billets aller-retour'
     and chemin = 'aaaaaaaa-0000-0000-0000-000000000002/billets.pdf' and taille = 120000;
  assert n = 1, 'Seul le nom doit changer';

  -- Son espace : ce qu'il a déposé.
  select count(*) into n from public.espace_des_documents() where utilise = 920000;
  assert n = 1, 'L''espace utilisé doit compter les fichiers de Thomas';
end $$;
reset role;
reset request.jwt.claims;

-- L'intrus : aucun fichier, aucune fiche, aucun dépôt, aucun retrait.
set role authenticated;
set request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';
do $$
declare n int;
begin
  select count(*) into n from public.documents_du_voyage;
  assert n = 0, format('FUITE : l''intrus voit %s fiche(s)', n);
  select count(*) into n from storage.objects where bucket_id = 'documents';
  assert n = 0, format('FUITE : l''intrus voit %s fichier(s)', n);
  delete from storage.objects where bucket_id = 'documents';
  get diagnostics n = row_count;
  assert n = 0, 'FAILLE : l''intrus a supprimé des fichiers';
  begin
    insert into storage.objects (bucket_id, name, metadata)
    values ('documents', 'aaaaaaaa-0000-0000-0000-000000000002/virus.pdf', '{"size": 10}');
    assert false, 'FAILLE : l''intrus a déposé un fichier';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
reset request.jwt.claims;

-- Le quota : au-delà de 50 Mo, Thomas ne dépose plus rien.
set role authenticated;
set request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
do $$
begin
  insert into storage.objects (bucket_id, name, metadata)
  values ('documents', 'aaaaaaaa-0000-0000-0000-000000000002/gros.pdf', '{"size": 60000000}');
  begin
    insert into storage.objects (bucket_id, name, metadata)
    values ('documents', 'aaaaaaaa-0000-0000-0000-000000000002/encore.pdf', '{"size": 10}');
    assert false, 'Le quota par personne n''a pas arrêté le dépôt';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
reset request.jwt.claims;

-- L'organisateur retire un document de son voyage, même déposé par un autre :
-- le fichier d'abord (sa fiche le lui rend visible), la fiche ensuite. Le
-- document privé de Thomas, qu'il ne voit pas, reste hors de sa portée.
set role authenticated;
set request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
do $$
declare n int;
begin
  delete from storage.objects where bucket_id = 'documents' and name = 'aaaaaaaa-0000-0000-0000-000000000002/passeport.jpg';
  get diagnostics n = row_count;
  assert n = 0, 'FAILLE : l''organisateur a supprimé le document privé de Thomas';
  delete from storage.objects where bucket_id = 'documents' and name = 'aaaaaaaa-0000-0000-0000-000000000002/billets.pdf';
  get diagnostics n = row_count;
  assert n = 1, format('L''organisateur doit pouvoir retirer un fichier de son voyage (%s)', n);
  delete from public.documents_du_voyage where id = '72000000-0000-0000-0000-000000000001';
  get diagnostics n = row_count;
  assert n = 1, format('L''organisateur doit pouvoir retirer une fiche de son voyage (%s)', n);
end $$;
reset role;
reset request.jwt.claims;

select '✅ Tests des documents passés' as resultat;
