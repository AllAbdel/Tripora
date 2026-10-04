-- ============================================================================
-- Tests des alertes de prix.
--
-- Un suivi est personnel ; les prix et les alertes ne s'écrivent que côté
-- serveur ; un abonnement suit le compte connecté sur le navigateur ; la clé
-- privée des notifications n'est lisible par personne d'autre que le serveur.
-- ============================================================================

\set ON_ERROR_STOP on
\timing off

-- Abdel (membre et organisateur du voyage aaaaaaaa…01) suit Lisbonne en juin.
set role authenticated;
set request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

insert into public.price_watches (id, trip_id, user_id, origin_iata, destination_id, destination_name, destination_iata, month)
values ('bbbbbbbb-0000-0000-0000-00000000a001', 'aaaaaaaa-0000-0000-0000-000000000001',
        '11111111-1111-1111-1111-111111111111', 'CDG', 'lisbonne', 'Lisbonne', array['LIS'], '2027-06');

do $$
begin
  -- Un prix écrit par le navigateur : refusé, seul le serveur relève.
  begin
    insert into public.price_watches (user_id, origin_iata, destination_id, destination_name, destination_iata, month, first_cents)
    values ('11111111-1111-1111-1111-111111111111', 'CDG', 'porto', 'Porto', array['OPO'], '2027-06', 100);
    raise exception 'Un prix écrit par le client aurait dû être refusé';
  exception when insufficient_privilege or check_violation then null;
  end;
  -- Un code d'aéroport qui n'en est pas un.
  begin
    insert into public.price_watches (user_id, origin_iata, destination_id, destination_name, destination_iata, month)
    values ('11111111-1111-1111-1111-111111111111', 'paris', 'porto', 'Porto', array['OPO'], '2027-06');
    raise exception 'Un code IATA invalide aurait dû être refusé';
  exception when check_violation then null;
  end;
  -- Suivre pour quelqu'un d'autre.
  begin
    insert into public.price_watches (user_id, origin_iata, destination_id, destination_name, destination_iata, month)
    values ('22222222-2222-2222-2222-222222222222', 'CDG', 'porto', 'Porto', array['OPO'], '2027-06');
    raise exception 'Un suivi au nom d''un autre aurait dû être refusé';
  exception when insufficient_privilege then null;
  end;
end $$;

reset role;
reset request.jwt.claims;

-- L'intrus : ni lecture, ni suivi sur un voyage dont il n'est pas membre.
set role authenticated;
set request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';

do $$
begin
  if exists (select 1 from public.price_watches) then
    raise exception 'L''intrus voit un suivi qui n''est pas le sien';
  end if;
  begin
    insert into public.price_watches (trip_id, user_id, origin_iata, destination_id, destination_name, destination_iata, month)
    values ('aaaaaaaa-0000-0000-0000-000000000001', '33333333-3333-3333-3333-333333333333',
            'CDG', 'lisbonne', 'Lisbonne', array['LIS'], '2027-06');
    raise exception 'Un suivi sur le voyage d''un autre groupe aurait dû être refusé';
  exception when insufficient_privilege then null;
  end;
  delete from public.price_watches where id = 'bbbbbbbb-0000-0000-0000-00000000a001';
end $$;

reset role;
reset request.jwt.claims;

do $$
begin
  if not exists (select 1 from public.price_watches where id = 'bbbbbbbb-0000-0000-0000-00000000a001') then
    raise exception 'L''intrus a supprimé le suivi d''Abdel';
  end if;
end $$;

-- Le serveur relève une baisse et écrit l'alerte.
insert into public.price_alerts (watch_id, user_id, old_cents, new_cents)
values ('bbbbbbbb-0000-0000-0000-00000000a001', '11111111-1111-1111-1111-111111111111', 18000, 12900);

set role authenticated;
set request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

do $$
begin
  if (select count(*) from public.price_alerts) <> 1 then
    raise exception 'Abdel devrait voir son alerte';
  end if;
  update public.price_alerts set seen_at = now();
  -- Le prix d'une alerte ne se réécrit pas.
  begin
    update public.price_alerts set new_cents = 1;
    raise exception 'Réécrire le prix d''une alerte aurait dû être refusé';
  exception when insufficient_privilege then null;
  end;
  -- La clé privée des notifications n'est pas lisible.
  begin
    perform 1 from public.cles_push;
    raise exception 'La clé privée des notifications ne doit pas être lisible';
  exception when insufficient_privilege then null;
  end;
  -- La publique, si : ici il n'y en a pas encore, et ce n'est pas une erreur.
  perform public.cle_publique_push();
end $$;

select public.enregistrer_abonnement_push(
  'https://push.exemple.test/abonnement-1', 'BIPUL12DLfytvTajnryr2PRdAgXS3HGKiLqndGcJGabyhHheJYlNGCeXl1dn18gSJ1WAkAPIxr4gK0_dQds4yiI', 'c2VjcmV0LWF1dGg'
);

reset role;
reset request.jwt.claims;

-- Thomas se connecte sur le même navigateur : l'abonnement le suit.
set role authenticated;
set request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';

select public.enregistrer_abonnement_push(
  'https://push.exemple.test/abonnement-1', 'BIPUL12DLfytvTajnryr2PRdAgXS3HGKiLqndGcJGabyhHheJYlNGCeXl1dn18gSJ1WAkAPIxr4gK0_dQds4yiI', 'c2VjcmV0LWF1dGg'
);

do $$
declare
  i integer;
begin
  if (select count(*) from public.push_subscriptions) <> 1 then
    raise exception 'Thomas devrait voir l''abonnement de ce navigateur';
  end if;
  if exists (select 1 from public.price_alerts) then
    raise exception 'Thomas voit les alertes d''Abdel';
  end if;
  -- Vingt suivis au plus.
  for i in 1..20 loop
    insert into public.price_watches (user_id, origin_iata, destination_id, destination_name, destination_iata, month)
    values ('22222222-2222-2222-2222-222222222222', 'CDG', 'ville-' || i, 'Ville ' || i, array['LIS'], '2027-06');
  end loop;
  begin
    insert into public.price_watches (user_id, origin_iata, destination_id, destination_name, destination_iata, month)
    values ('22222222-2222-2222-2222-222222222222', 'CDG', 'ville-21', 'Ville 21', array['LIS'], '2027-06');
    raise exception 'Un vingt et unième suivi aurait dû être refusé';
  exception when sqlstate 'P0020' then null;
  end;
  delete from public.price_watches where destination_id like 'ville-%';
end $$;

reset role;
reset request.jwt.claims;

do $$
begin
  if (select user_id from public.push_subscriptions where endpoint = 'https://push.exemple.test/abonnement-1')
     <> '22222222-2222-2222-2222-222222222222' then
    raise exception 'L''abonnement aurait dû changer de propriétaire';
  end if;
end $$;

-- Nettoyage : les tests suivants comptent les lignes de ces comptes.
delete from public.push_subscriptions;
delete from public.price_watches;

select '✅ Tests des alertes de prix passés' as resultat;
