-- ============================================================================
-- Les deux premiers parrainages, et une banque de plus au catalogue.
--
-- Wise était déjà recommandé sur ses mérites, avant qu'il soit question d'en
-- tirer quoi que ce soit : c'est ce qui rend le parrainage acceptable ici. Le
-- jour où l'ordre du catalogue changerait à cause d'un lien, la fiche ne
-- vaudrait plus rien — d'où le classement qui l'ignore, et le test qui le
-- vérifie.
--
-- BoursoBank arrive avec sa propre fiche parce qu'elle a un vrai mérite en
-- voyage : le paiement et le retrait en devise sans frais sur plusieurs
-- formules. La réserve est écrite noir sur blanc, parce qu'elle est réelle :
-- l'offre est réservée aux résidents français et demande un versement
-- initial.
-- ============================================================================

update public.travel_apps
set referral_url  = 'https://wise.com/invite/ahpc/abdelslama1',
    referral_note = 'Lien de parrainage : Tripora et vous recevons chacun un avantage à l’ouverture. Le lien direct est juste à côté.',
    updated_at    = now()
where id = 'wise';

insert into public.travel_apps
  (id, name, category, tagline, why, caveat,
   ios_url, android_url, web_url, referral_url, referral_note,
   country_codes, destination_ids, status, priority)
values (
  'boursobank', 'BoursoBank', 'argent',
  'Payer et retirer en devise sans frais, depuis un compte français.',
  'Selon la formule, les paiements et les retraits à l’étranger ne coûtent rien — ni commission, ni frais fixes. Sur deux semaines de voyage, c’est l’écart entre une banque classique et elle qui paie les repas.',
  'Offre réservée aux résidents fiscaux français, avec un versement initial à l’ouverture. Les conditions de gratuité dépendent de la formule choisie : vérifiez celle qui correspond à votre usage avant d’ouvrir.',
  'https://apps.apple.com/search?term=BoursoBank',
  'https://play.google.com/store/search?q=BoursoBank&c=apps',
  'https://www.boursobank.com',
  'https://bour.so/p/xyxvlP0GvdG',
  'Lien de parrainage : Tripora et vous recevons chacun une récompense si le compte est ouvert avec un premier versement. Le lien direct est juste à côté.',
  array['FR']::text[], '{}', 'published', 65
)
on conflict (id) do update set
  referral_url  = excluded.referral_url,
  referral_note = excluded.referral_note,
  caveat        = excluded.caveat,
  updated_at    = now();
