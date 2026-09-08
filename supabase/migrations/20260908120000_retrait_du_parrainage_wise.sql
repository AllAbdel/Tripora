-- ============================================================================
-- Retrait du lien de parrainage Wise.
--
-- Les conditions du Programme de parrainage Wise (version du 5 mai 2026) le
-- réservent sans ambiguïté au cercle privé :
--
--  - 2.3 « exclusivement destiné à un usage personnel et individuel, et non à
--    un usage commercial » ;
--  - 2.4 vise expressément l'usage « via un site web, les réseaux sociaux, ou
--    tout type d'activités publicitaires et de marketing » ;
--  - 3.1 (i) interdit de partager le lien avec quelqu'un qui n'a pas demandé à
--    recevoir des informations sur Wise ;
--  - 3.1 (j) interdit de le partager « en dehors de votre cercle familial et
--    de votre cercle d'amis ».
--
-- Une application ouverte à qui veut s'inscrire n'entre dans aucune de ces
-- cases. Et la sanction prévue n'est pas symbolique : la clause 6.1 (c) permet
-- à Wise de résilier l'accès à ses services, c'est-à-dire au compte lui-même.
-- Quelques euros de parrainage ne valent pas ce risque.
--
-- Wise reste recommandé, sur ses mérites et avec son lien direct : c'est ce
-- qu'il était avant qu'il soit question d'en tirer quoi que ce soit, et la
-- fiche ne perd rien à la manœuvre.
--
-- La voie légitime pour ce cas existe, et Wise la nomme lui-même en 2.4 : le
-- Programme de Partenariat Affilié. Le jour où il sera ouvert, remettre un
-- lien tiendra en une ligne — la colonne est déjà là.
-- ============================================================================

update public.travel_apps
   set referral_url = null, referral_note = null, updated_at = now()
 where id = 'wise';

comment on column public.travel_apps.referral_url is
  'Lien de parrainage, en plus du lien direct et jamais à sa place. Posé uniquement par un administrateur : un déclencheur efface le champ sur toute écriture faite par quelqu''un d''autre. À ne remplir que si le programme concerné autorise la diffusion publique — la plupart des programmes de parrainage la réservent au cercle familial et amical, et la sanction va jusqu''à la fermeture du compte.';
