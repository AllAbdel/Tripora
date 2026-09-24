-- ============================================================================
-- Tests de la suppression de compte.
--
-- Joué en dernier : il efface des comptes dont les autres tests se servent.
-- Il pose son propre voyage : Abdel l'organise, Thomas en est membre, y a
-- payé une dépense et déposé un document.
-- ============================================================================

\set ON_ERROR_STOP on
\timing off

insert into public.trips (id, owner_id, title, origin_name, origin_lat, origin_lng)
values ('aaaaaaaa-0000-0000-0000-0000000000c0', '11111111-1111-1111-1111-111111111111',
        'Voyage de la suppression', 'Paris', 48.85, 2.35);
insert into public.trip_members (trip_id, user_id, role)
values ('aaaaaaaa-0000-0000-0000-0000000000c0', '22222222-2222-2222-2222-222222222222', 'member')
on conflict do nothing;
insert into public.expenses (trip_id, paid_by, created_by, amount_cents, amount_home_cents, label)
values ('aaaaaaaa-0000-0000-0000-0000000000c0', '22222222-2222-2222-2222-222222222222',
        '22222222-2222-2222-2222-222222222222', 4200, 4200, 'Courses de Thomas'),
       ('aaaaaaaa-0000-0000-0000-0000000000c0', '11111111-1111-1111-1111-111111111111',
        '11111111-1111-1111-1111-111111111111', 3000, 3000, 'Essence d''Abdel');
insert into storage.objects (bucket_id, name, owner_id, metadata)
values ('documents', 'aaaaaaaa-0000-0000-0000-0000000000c0/billet-thomas.pdf',
        '22222222-2222-2222-2222-222222222222', '{"size": 10}'),
       ('documents', 'aaaaaaaa-0000-0000-0000-0000000000c0/billet-abdel.pdf',
        '11111111-1111-1111-1111-111111111111', '{"size": 10}');

-- Sans connexion : rien.
do $$
begin
  begin
    perform public.supprimer_mon_compte();
    raise exception 'Une suppression sans connexion doit échouer';
  exception when insufficient_privilege then null;
  end;
end $$;

-- Thomas part.
set role authenticated;
set request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
select public.supprimer_mon_compte();
reset role;
reset request.jwt.claims;

do $$
begin
  assert not exists (select 1 from auth.users where id = '22222222-2222-2222-2222-222222222222'),
    'Le compte de Thomas doit avoir disparu';
  assert not exists (select 1 from public.profiles where id = '22222222-2222-2222-2222-222222222222'),
    'Son profil aussi';
  -- Le voyage d'Abdel reste, sans Thomas ni sa dépense ; celle d'Abdel reste.
  assert exists (select 1 from public.trips where id = 'aaaaaaaa-0000-0000-0000-0000000000c0'),
    'Le voyage d''un autre ne doit pas partir avec Thomas';
  assert not exists (select 1 from public.trip_members
                      where user_id = '22222222-2222-2222-2222-222222222222'),
    'Thomas ne doit plus être membre de rien';
  assert not exists (select 1 from public.expenses where label = 'Courses de Thomas'),
    'La dépense de Thomas doit être partie';
  assert exists (select 1 from public.expenses where label = 'Essence d''Abdel'),
    'La dépense d''Abdel doit rester';
  -- Son document est noté à effacer ; pas celui d'Abdel.
  assert exists (select 1 from public.fichiers_a_effacer
                  where chemin = 'aaaaaaaa-0000-0000-0000-0000000000c0/billet-thomas.pdf'),
    'Le document de Thomas doit être noté à effacer';
  assert not exists (select 1 from public.fichiers_a_effacer
                      where chemin = 'aaaaaaaa-0000-0000-0000-0000000000c0/billet-abdel.pdf'),
    'Le document d''Abdel ne doit pas être effacé';
end $$;

-- Abdel part : son voyage part avec lui, et tous ses fichiers sont notés.
set role authenticated;
set request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
select public.supprimer_mon_compte();
reset role;
reset request.jwt.claims;

do $$
begin
  assert not exists (select 1 from auth.users where id = '11111111-1111-1111-1111-111111111111'),
    'Le compte d''Abdel doit avoir disparu';
  assert not exists (select 1 from public.trips where owner_id = '11111111-1111-1111-1111-111111111111'),
    'Les voyages qu''Abdel organisait doivent être partis';
  assert exists (select 1 from public.fichiers_a_effacer
                  where chemin = 'aaaaaaaa-0000-0000-0000-0000000000c0/billet-abdel.pdf'),
    'Les documents de ses voyages doivent être notés à effacer';
  -- L'intrus, lui, n'a rien perdu.
  assert exists (select 1 from auth.users where id = '33333333-3333-3333-3333-333333333333'),
    'Un autre compte ne doit pas être touché';
end $$;

select '✅ Tests de la suppression de compte passés' as resultat;
