-- ============================================================================
-- Tests des moyens de paiement.
--
-- S'appuie sur rls_test.sql : Abdel et Thomas voyagent ensemble (voyage
-- aaaaaaaa-…-0002), l'intrus n'est d'aucun de leurs voyages.
-- ============================================================================

\set ON_ERROR_STOP on
\timing off

-- Thomas enregistre les siens.
set role authenticated;
set request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
do $$
declare n int;
begin
  insert into public.moyens_de_paiement (paypal, iban, titulaire)
  values ('thomasm', 'FR7630006000011234567890189', 'Thomas Martin');

  -- Au nom d'un autre : refusé.
  begin
    insert into public.moyens_de_paiement (user_id, paypal)
    values ('11111111-1111-1111-1111-111111111111', 'piege');
    assert false, 'FAILLE : Thomas a pu enregistrer un moyen de paiement au nom d''Abdel';
  exception when insufficient_privilege then null;
  end;

  -- Un lien entier au lieu d'un identifiant : refusé, l'application construit
  -- les liens elle-même.
  begin
    update public.moyens_de_paiement set paypal = 'https://evil.example/x';
    assert false, 'FAILLE : une adresse arbitraire a été acceptée comme identifiant PayPal';
  exception when check_violation then null;
  end;

  -- Changer de propriétaire en modifiant : sans effet.
  update public.moyens_de_paiement set user_id = '11111111-1111-1111-1111-111111111111', revolut = 'thomas.m';
  select count(*) into n from public.moyens_de_paiement
   where user_id = '22222222-2222-2222-2222-222222222222' and revolut = 'thomas.m';
  assert n = 1, 'FAILLE : le propriétaire d''un moyen de paiement a pu être changé';
end $$;
reset role;
reset request.jwt.claims;

-- Abdel, qui voyage avec Thomas, les lit ; il ne peut pas les modifier.
set role authenticated;
set request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
do $$
declare n int;
begin
  select count(*) into n from public.moyens_de_paiement
   where user_id = '22222222-2222-2222-2222-222222222222' and iban = 'FR7630006000011234567890189';
  assert n = 1, format('Abdel doit lire les moyens de paiement de son covoyageur (%s)', n);
  update public.moyens_de_paiement set paypal = 'abdel' where user_id = '22222222-2222-2222-2222-222222222222';
  get diagnostics n = row_count;
  assert n = 0, 'FAILLE : Abdel a pu modifier les moyens de paiement de Thomas';
end $$;
reset role;
reset request.jwt.claims;

-- L'intrus ne voyage avec personne : il ne lit rien.
set role authenticated;
set request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';
do $$
declare n int;
begin
  select count(*) into n from public.moyens_de_paiement;
  assert n = 0, format('FUITE : l''intrus lit %s moyen(s) de paiement', n);
end $$;
reset role;
reset request.jwt.claims;

select '✅ Tests des moyens de paiement passés' as resultat;
