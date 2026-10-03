-- ============================================================================
-- Tests des erreurs remontées par l'application.
--
-- N'importe qui peut écrire une erreur (même sans compte), personne ne peut
-- les relire depuis l'application, et un message trop long est refusé.
-- ============================================================================

\set ON_ERROR_STOP on
\timing off

-- Un navigateur sans compte remonte une erreur.
set role anon;
insert into public.erreurs_client (message, page, version, plateforme, langue, navigateur)
values ('Cannot read properties of undefined', '/voyages/:id', 'abc1234', 'web', 'fr', 'Chrome 141');

do $$
begin
  -- Relire les erreurs : refusé.
  begin
    perform count(*) from public.erreurs_client;
    raise exception 'Les erreurs n''auraient pas dû être lisibles par anon';
  exception when insufficient_privilege then null;
  end;
  -- Un message démesuré : refusé (par la politique, avant même la contrainte).
  begin
    insert into public.erreurs_client (message) values (repeat('x', 501));
    raise exception 'Un message de 501 caractères aurait dû être refusé';
  exception when insufficient_privilege or check_violation then null;
  end;
  -- Une plateforme inventée : refusée.
  begin
    insert into public.erreurs_client (message, plateforme) values ('Essai', 'grille-pain');
    raise exception 'Une plateforme inconnue aurait dû être refusée';
  exception when check_violation then null;
  end;
  -- Écrire la date à sa guise : refusé (seules les colonnes du message sont ouvertes).
  begin
    insert into public.erreurs_client (message, cree_le) values ('Essai', now() - interval '1 year');
    raise exception 'La date d''une erreur n''aurait pas dû être modifiable';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

-- Un compte connecté aussi.
set role authenticated;
set request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
insert into public.erreurs_client (message, plateforme) values ('Chunk load failed', 'android');
reset role;
reset request.jwt.claims;

do $$
begin
  if (select count(*) from public.erreurs_client) <> 2 then
    raise exception 'Deux erreurs attendues, % trouvées', (select count(*) from public.erreurs_client);
  end if;
end $$;

\echo '   erreurs remontées : écriture seule, messages bornés'
