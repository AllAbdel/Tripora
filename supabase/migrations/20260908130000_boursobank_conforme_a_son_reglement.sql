-- ============================================================================
-- BoursoBank : le lien reste, la formulation change.
--
-- Lecture faite du Règlement du parrainage BoursoBank, il dit à peu près
-- l'inverse de celui de Wise, et c'est la leçon la plus utile de l'épisode :
-- deux programmes de parrainage n'ont rien de comparable, il faut lire chacun.
--
-- Ce qu'il **autorise** — article 2 : le parrain peut « envoyer une invitation
-- via un moyen de communication à distance (sms, réseaux sociaux, etc.) qui
-- contiendra son code de parrainage unique ». Aucune clause de cercle familial
-- et amical, aucune interdiction d'usage commercial, aucune restriction de
-- canal. Le lien peut donc figurer ici.
--
-- Ce qu'il **encadre**, et qui nous concerne :
--
--  - **4.7** interdit « toute modification des conditions de l'Offre
--    Parrainage sous peine d'exclusion ». Notre fiche ne doit donc ni chiffrer
--    la prime, ni énoncer des conditions d'éligibilité de son cru. Elle
--    décrit, et renvoie au texte officiel qui fait foi. C'est l'objet de cette
--    migration : la réserve précédente parlait de « résidents fiscaux
--    français », ce qui ne figure pas dans le règlement — c'est une condition
--    d'ouverture de compte, pas une condition de l'offre.
--  - **4.3** plafonne à vingt primes sur douze mois glissants. Rien à changer
--    dans le code, mais c'est le plafond de ce que cette ligne peut rapporter.
--  - **article 1** : le parrain doit détenir, en plus du compte, au moins un
--    produit de la liste (carte active, assurance, livret, crédit, produit de
--    Bourse). Un compte et un CSL seuls ne suffisent pas à être parrain.
-- ============================================================================

update public.travel_apps
set caveat = 'Réservé aux personnes majeures qui n’ont jamais été clientes de BoursoBank. Le montant de la prime et les conditions exactes figurent sur la page officielle de l’offre, et changent régulièrement : ce sont elles qui font foi.',
    referral_note = 'Lien de parrainage : une prime pour vous et pour Tripora à l’ouverture effective du compte, selon l’offre en cours. Le lien direct est juste à côté.',
    updated_at = now()
where id = 'boursobank';
