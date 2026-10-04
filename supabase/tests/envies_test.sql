-- ============================================================================
-- Tests des envies anonymes (votes sur les activités, sujet `place`).
--
-- S'appuie sur l'état laissé par rls_test.sql : le voyage aaaaaaaa-…-0002
-- d'Abdel (organisateur), dont Thomas est membre et l'intrus non.
-- ============================================================================

\set ON_ERROR_STOP on
\timing off

-- Thomas a envie du Batur.
set role authenticated;
set request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
insert into public.votes (trip_id, subject_type, subject_id, user_id, value)
values ('aaaaaaaa-0000-0000-0000-000000000002', 'place', 'bali/batur', '22222222-2222-2222-2222-222222222222', 'like');
reset role;
reset request.jwt.claims;

-- Abdel aussi, et le Kecak, sans lui.
set role authenticated;
set request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
do $$
declare n int; ligne record;
begin
  insert into public.votes (trip_id, subject_type, subject_id, user_id, value)
  values ('aaaaaaaa-0000-0000-0000-000000000002', 'place', 'bali/batur', '11111111-1111-1111-1111-111111111111', 'like'),
         ('aaaaaaaa-0000-0000-0000-000000000002', 'place', 'bali/kecak', '11111111-1111-1111-1111-111111111111', 'dislike');

  -- Il ne voit que ses propres avis : pas celui de Thomas.
  select count(*) into n from public.votes
   where trip_id = 'aaaaaaaa-0000-0000-0000-000000000002' and subject_type = 'place';
  assert n = 2, format('Abdel doit ne voir que ses 2 avis, il en voit %s', n);
  select count(*) into n from public.votes
   where subject_type = 'place' and user_id = '22222222-2222-2222-2222-222222222222';
  assert n = 0, 'FUITE : Abdel lit l''envie de Thomas';

  -- Les comptes, eux, disent tout ce qu'il faut : combien, pas qui.
  select * into ligne from public.envies_du_voyage('aaaaaaaa-0000-0000-0000-000000000002') where subject_id = 'bali/batur';
  assert ligne.pour = 2 and ligne.contre = 0 and ligne.moi = 'like' and ligne.votants = 2,
    format('Batur : 2 pour, mon avis « like », 2 votants attendus (%s)', row_to_json(ligne));
  select * into ligne from public.envies_du_voyage('aaaaaaaa-0000-0000-0000-000000000002') where subject_id = 'bali/kecak';
  assert ligne.pour = 0 and ligne.contre = 1 and ligne.moi = 'dislike',
    format('Kecak : 1 contre, mon avis « dislike » attendus (%s)', row_to_json(ligne));

  -- Le signal a bougé, et le groupe le voit.
  select count(*) into n from public.envies_modifiees where trip_id = 'aaaaaaaa-0000-0000-0000-000000000002';
  assert n = 1, 'Le signal des envies doit exister et être lisible par les membres';
end $$;
reset role;
reset request.jwt.claims;

-- Thomas ne voit pas les avis d'Abdel, mais les comptes, oui ; et les votes
-- sur la destination restent lisibles par tout le groupe.
set role authenticated;
set request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
do $$
declare n int; ligne record;
begin
  select count(*) into n from public.votes where subject_type = 'place' and user_id = '11111111-1111-1111-1111-111111111111';
  assert n = 0, 'FUITE : Thomas lit les envies d''Abdel';
  select * into ligne from public.envies_du_voyage('aaaaaaaa-0000-0000-0000-000000000002') where subject_id = 'bali/batur';
  assert ligne.pour = 2 and ligne.moi = 'like', 'Thomas doit voir 2 envies pour le Batur, dont la sienne';
  select * into ligne from public.envies_du_voyage('aaaaaaaa-0000-0000-0000-000000000002') where subject_id = 'bali/kecak';
  assert ligne.contre = 1 and ligne.moi is null, 'Thomas voit un « sans moi » sur le Kecak, qui n''est pas le sien';
  select count(*) into n from public.votes
   where trip_id = 'aaaaaaaa-0000-0000-0000-000000000002' and subject_type = 'proposal'
     and user_id <> '22222222-2222-2222-2222-222222222222';
  assert n > 0, 'Les votes sur la destination doivent rester lisibles par le groupe';
end $$;
reset role;
reset request.jwt.claims;

-- L'intrus : ni avis, ni comptes, ni signal.
set role authenticated;
set request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';
do $$
declare n int;
begin
  select count(*) into n from public.envies_du_voyage('aaaaaaaa-0000-0000-0000-000000000002');
  assert n = 0, format('FUITE : l''intrus obtient %s compte(s) d''envies', n);
  select count(*) into n from public.envies_modifiees;
  assert n = 0, 'FUITE : l''intrus voit le signal des envies';
  select count(*) into n from public.votes where subject_type = 'place';
  assert n = 0, 'FUITE : l''intrus lit des envies';
end $$;
reset role;
reset request.jwt.claims;

-- Supprimer un voyage qui a des envies : le signal ne doit pas l'empêcher.
do $$
declare n int;
begin
  insert into public.trips (id, owner_id, title, origin_name, origin_lat, origin_lng)
  values ('aaaaaaaa-0000-0000-0000-0000000000ff', '11111111-1111-1111-1111-111111111111', 'À supprimer', 'Paris', 48.85, 2.35);
  insert into public.votes (trip_id, subject_type, subject_id, user_id, value)
  values ('aaaaaaaa-0000-0000-0000-0000000000ff', 'place', 'bali/batur', '11111111-1111-1111-1111-111111111111', 'like');
  delete from public.trips where id = 'aaaaaaaa-0000-0000-0000-0000000000ff';
  select count(*) into n from public.envies_modifiees where trip_id = 'aaaaaaaa-0000-0000-0000-0000000000ff';
  assert n = 0, 'Le signal d''un voyage supprimé doit partir avec lui';
end $$;

select '✅ Tests des envies anonymes passés' as resultat;
