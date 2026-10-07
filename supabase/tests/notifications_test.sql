-- ============================================================================
-- Tests des notifications du groupe.
--
-- Un voyage neuf, « Lisbonne entre potes », d'Abdel (organisateur), que
-- Thomas rejoint. Abdel et Thomas ont chacun un appareil abonné ; l'intrus
-- n'en a pas. On vérifie ce que la base met en file, pour qui, et ce qu'elle
-- n'y met pas.
-- ============================================================================

\set ON_ERROR_STOP on
\timing off

insert into public.trips (id, owner_id, title, origin_name, origin_lat, origin_lng)
values ('aaaaaaaa-0000-0000-0000-0000000000a1', '11111111-1111-1111-1111-111111111111', 'Lisbonne entre potes', 'Paris', 48.85, 2.35);

insert into public.push_subscriptions (user_id, endpoint, p256dh, auth) values
  ('11111111-1111-1111-1111-111111111111', 'https://push.exemple.test/abdel', repeat('a', 40), repeat('b', 16)),
  ('22222222-2222-2222-2222-222222222222', 'https://push.exemple.test/thomas', repeat('c', 40), repeat('d', 16));

-- Thomas rejoint : Abdel est prévenu, pas Thomas.
insert into public.trip_members (trip_id, user_id, role)
values ('aaaaaaaa-0000-0000-0000-0000000000a1', '22222222-2222-2222-2222-222222222222', 'member');

do $$
declare ligne public.notifications_a_envoyer; n int;
begin
  select * into ligne from public.notifications_a_envoyer
   where trip_id = 'aaaaaaaa-0000-0000-0000-0000000000a1' and genre = 'membre';
  assert ligne.destinataire = '11111111-1111-1111-1111-111111111111', 'Abdel doit être prévenu de l''arrivée de Thomas';
  assert ligne.donnees ->> 'qui' = 'Thomas' and ligne.donnees ->> 'voyage' = 'Lisbonne entre potes',
    format('Arrivée : nom et voyage attendus (%s)', ligne.donnees);
  select count(*) into n from public.notifications_a_envoyer
   where trip_id = 'aaaaaaaa-0000-0000-0000-0000000000a1' and destinataire = '22222222-2222-2222-2222-222222222222';
  assert n = 0, 'Thomas ne doit pas être prévenu de sa propre arrivée';
end $$;

-- L'intrus rejoint aussi, le temps de vérifier qu'il ne reçoit rien : il n'a
-- aucun appareil abonné.
insert into public.trip_members (trip_id, user_id, role)
values ('aaaaaaaa-0000-0000-0000-0000000000a1', '33333333-3333-3333-3333-333333333333', 'member');

-- Thomas écrit deux messages : une seule notification pour Abdel, qui compte.
set role authenticated;
set request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
insert into public.trip_messages (trip_id, author_id, body)
values ('aaaaaaaa-0000-0000-0000-0000000000a1', '22222222-2222-2222-2222-222222222222', 'On part à quelle heure ?'),
       ('aaaaaaaa-0000-0000-0000-0000000000a1', '22222222-2222-2222-2222-222222222222', 'Je propose 7 h à la gare.');
reset role;
reset request.jwt.claims;

do $$
declare ligne public.notifications_a_envoyer; n int;
begin
  select count(*) into n from public.notifications_a_envoyer where genre = 'message';
  assert n = 1, format('Une seule notification de message attendue (regroupées), %s', n);
  select * into ligne from public.notifications_a_envoyer where genre = 'message';
  assert ligne.destinataire = '11111111-1111-1111-1111-111111111111', 'Le message doit aller à Abdel';
  assert (ligne.donnees ->> 'nombre')::int = 2, format('Deux messages comptés attendus (%s)', ligne.donnees);
  assert ligne.donnees ->> 'extrait' = 'Je propose 7 h à la gare.', 'L''extrait doit être celui du dernier message';
  select count(*) into n from public.notifications_a_envoyer where destinataire = '33333333-3333-3333-3333-333333333333';
  assert n = 0, 'Sans appareil abonné, l''intrus ne doit rien recevoir';
end $$;

delete from public.trip_members
 where trip_id = 'aaaaaaaa-0000-0000-0000-0000000000a1' and user_id = '33333333-3333-3333-3333-333333333333';

-- Abdel coupe la discussion : le message suivant ne s'ajoute pas.
set role authenticated;
set request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
insert into public.reglages_de_notification (discussion) values (false);
reset role;
reset request.jwt.claims;

set role authenticated;
set request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
insert into public.trip_messages (trip_id, author_id, body)
values ('aaaaaaaa-0000-0000-0000-0000000000a1', '22222222-2222-2222-2222-222222222222', 'Personne ne répond ?');
do $$
declare n int;
begin
  -- Thomas ne lit ni la file ni les réglages d'Abdel.
  begin
    select count(*) into n from public.notifications_a_envoyer;
    assert false, 'FUITE : un membre lit la file des notifications';
  exception when insufficient_privilege then null;
  end;
  select count(*) into n from public.reglages_de_notification;
  assert n = 0, 'FUITE : Thomas lit les réglages d''Abdel';
  begin
    perform public.mettre_en_file('11111111-1111-1111-1111-111111111111', null, 'message', '{}'::jsonb);
    assert false, 'FAILLE : un membre peut mettre une notification en file pour un autre';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
reset request.jwt.claims;

do $$
declare nombre int;
begin
  select (donnees ->> 'nombre')::int into nombre from public.notifications_a_envoyer where genre = 'message';
  assert nombre = 2, format('Discussion coupée : le compte doit rester à 2, il est à %s', nombre);
end $$;

-- Thomas saisit une dépense partagée : Abdel est prévenu, avec le montant.
set role authenticated;
set request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
do $$
declare depense uuid;
begin
  insert into public.expenses (trip_id, paid_by, amount_cents, currency, fx_rate, amount_home_cents, label, created_by)
  values ('aaaaaaaa-0000-0000-0000-0000000000a1', '22222222-2222-2222-2222-222222222222', 4500, 'EUR', 1, 4500, 'Restaurant', '22222222-2222-2222-2222-222222222222')
  returning id into depense;
  insert into public.expense_shares (expense_id, user_id, share_cents) values
    (depense, '22222222-2222-2222-2222-222222222222', 2250),
    (depense, '11111111-1111-1111-1111-111111111111', 2250);

  -- Un sondage, et deux tâches : l'une pour Abdel, l'autre pour lui-même.
  insert into public.sondages (trip_id, question, secret)
  values ('aaaaaaaa-0000-0000-0000-0000000000a1', 'Quel quartier ?', true);
  insert into public.taches (trip_id, titre, responsable)
  values ('aaaaaaaa-0000-0000-0000-0000000000a1', 'Réserver le tram 28', '11111111-1111-1111-1111-111111111111'),
         ('aaaaaaaa-0000-0000-0000-0000000000a1', 'Imprimer les billets', '22222222-2222-2222-2222-222222222222');
end $$;
reset role;
reset request.jwt.claims;

do $$
declare ligne public.notifications_a_envoyer; n int;
begin
  select * into ligne from public.notifications_a_envoyer where genre = 'depense';
  assert ligne.destinataire = '11111111-1111-1111-1111-111111111111', 'La dépense doit aller à Abdel, pas à Thomas';
  assert (ligne.donnees ->> 'montant')::int = 4500 and ligne.donnees ->> 'devise' = 'EUR' and ligne.donnees ->> 'libelle' = 'Restaurant',
    format('Dépense : montant, devise et libellé attendus (%s)', ligne.donnees);
  select count(*) into n from public.notifications_a_envoyer where genre = 'depense';
  assert n = 1, format('Une seule notification de dépense attendue, %s', n);

  select * into ligne from public.notifications_a_envoyer where genre = 'sondage';
  assert ligne.destinataire = '11111111-1111-1111-1111-111111111111' and ligne.donnees ->> 'question' = 'Quel quartier ?'
     and (ligne.donnees ->> 'secret')::boolean, format('Sondage : question et vote secret attendus (%s)', ligne.donnees);

  select count(*) into n from public.notifications_a_envoyer where genre = 'tache';
  assert n = 1, format('Une seule tâche confiée à quelqu''un d''autre attendue, %s', n);
  select * into ligne from public.notifications_a_envoyer where genre = 'tache';
  assert ligne.destinataire = '11111111-1111-1111-1111-111111111111' and ligne.donnees ->> 'titre' = 'Réserver le tram 28',
    format('Tâche confiée à Abdel attendue (%s)', ligne.donnees);
end $$;

-- Le rappel des envies : Thomas, membre depuis plus d'un jour, n'a rien dit.
-- Une fois par semaine au plus.
update public.trip_members set joined_at = now() - interval '2 days'
 where trip_id = 'aaaaaaaa-0000-0000-0000-0000000000a1' and user_id = '22222222-2222-2222-2222-222222222222';
do $$
declare n int; ligne public.notifications_a_envoyer;
begin
  perform public.rappeler_les_envies();
  perform public.rappeler_les_envies();
  select count(*) into n from public.notifications_a_envoyer where genre = 'envies';
  assert n = 1, format('Un seul rappel des envies attendu, %s', n);
  select * into ligne from public.notifications_a_envoyer where genre = 'envies';
  assert ligne.destinataire = '22222222-2222-2222-2222-222222222222', 'Le rappel doit aller à Thomas';
end $$;

-- Les votes : Abdel d'abord, puis Thomas. Le groupe au complet, l'organisateur
-- est prévenu — sans savoir qui a voté quoi.
set role authenticated;
set request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
insert into public.votes (trip_id, subject_type, subject_id, user_id, value)
values ('aaaaaaaa-0000-0000-0000-0000000000a1', 'proposal', 'barcelone', auth.uid(), 'like');
reset role;
reset request.jwt.claims;

do $$
declare n int;
begin
  select count(*) into n from public.notifications_a_envoyer where genre = 'tous_ont_vote';
  assert n = 0, 'Un vote sur deux : personne à prévenir';
end $$;

set role authenticated;
set request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
insert into public.votes (trip_id, subject_type, subject_id, user_id, value)
values ('aaaaaaaa-0000-0000-0000-0000000000a1', 'proposal', 'barcelone', auth.uid(), 'dislike');
reset role;
reset request.jwt.claims;

do $$
declare ligne public.notifications_a_envoyer;
begin
  select * into ligne from public.notifications_a_envoyer where genre = 'tous_ont_vote';
  assert ligne.destinataire = '11111111-1111-1111-1111-111111111111', 'L''organisateur doit être prévenu que tout le monde a voté';
  assert ligne.donnees = jsonb_build_object('voyage', 'Lisbonne entre potes', 'votants', 2),
    format('FUITE : la notification des votes ne doit dire ni qui ni quoi (%s)', ligne.donnees);
end $$;

-- Abdel tranche : Thomas est prévenu, Abdel non.
set role authenticated;
set request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
update public.trips set destination_locked_id = 'barcelone', status = 'planned'
 where id = 'aaaaaaaa-0000-0000-0000-0000000000a1';
reset role;
reset request.jwt.claims;

do $$
declare ligne public.notifications_a_envoyer; n int;
begin
  select count(*) into n from public.notifications_a_envoyer where genre = 'destination';
  assert n = 1, format('Une seule notification de destination attendue, %s', n);
  select * into ligne from public.notifications_a_envoyer where genre = 'destination';
  assert ligne.destinataire = '22222222-2222-2222-2222-222222222222', 'Thomas doit apprendre la destination';
  assert ligne.donnees ->> 'destinationId' = 'barcelone' and length(ligne.donnees ->> 'destination') > 0,
    format('Destination : nom et identifiant attendus (%s)', ligne.donnees);
end $$;

-- Une fois partie, une notification ne regroupe plus : le message suivant en
-- ouvre une nouvelle. Et le ménage efface ce qui est parti depuis sept jours.
update public.notifications_a_envoyer set envoye_le = now(), donnees = '{}'::jsonb;
update public.reglages_de_notification set discussion = true where user_id = '11111111-1111-1111-1111-111111111111';
set role authenticated;
set request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
insert into public.trip_messages (trip_id, author_id, body)
values ('aaaaaaaa-0000-0000-0000-0000000000a1', '22222222-2222-2222-2222-222222222222', 'Ah, vous êtes là !');
reset role;
reset request.jwt.claims;

do $$
declare n int;
begin
  select count(*) into n from public.notifications_a_envoyer where genre = 'message' and envoye_le is null;
  assert n = 1, format('Un nouveau message après envoi doit ouvrir une nouvelle notification, %s', n);

  update public.notifications_a_envoyer set envoye_le = now() - interval '8 days' where envoye_le is not null;
  perform public.rappeler_les_envies();
  select count(*) into n from public.notifications_a_envoyer where envoye_le is not null;
  assert n = 0, format('Les notifications envoyées depuis plus de sept jours doivent disparaître, %s restent', n);
end $$;

-- Ménage : le voyage, la file et les abonnements de ce test.
delete from public.trips where id = 'aaaaaaaa-0000-0000-0000-0000000000a1';
delete from public.push_subscriptions where endpoint like 'https://push.exemple.test/%';

do $$
declare n int;
begin
  select count(*) into n from public.notifications_a_envoyer where trip_id = 'aaaaaaaa-0000-0000-0000-0000000000a1';
  assert n = 0, 'La file d''un voyage supprimé doit partir avec lui';
end $$;

-- Les fonctions de déclenchement ne s'appellent pas depuis l'API.
do $$
declare fonction text;
begin
  foreach fonction in array array[
    'notifier_un_message()', 'notifier_une_depense()', 'notifier_une_arrivee()', 'notifier_un_sondage()',
    'notifier_la_destination()', 'notifier_une_tache()', 'notifier_les_votes_complets()',
    'signaler_les_votes()', 'signaler_une_voix()', 'sondage_votes_secret()'
  ] loop
    assert not has_function_privilege('anon', 'public.' || fonction, 'execute'),
      format('FAILLE : anon peut exécuter %s', fonction);
    assert not has_function_privilege('authenticated', 'public.' || fonction, 'execute'),
      format('FAILLE : un membre peut exécuter %s', fonction);
  end loop;
end $$;

select '✅ Tests des notifications du groupe passés' as resultat;
