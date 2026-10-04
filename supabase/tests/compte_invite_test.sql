-- ============================================================================
-- Tests du compte invité devenu vrai compte.
--
-- Supabase bascule `auth.users.is_anonymous` quand un invité rattache Google
-- ou une adresse e-mail ; le profil doit suivre, sans perdre le nom choisi.
-- ============================================================================

\set ON_ERROR_STOP on
\timing off

-- Deux invités : Inès a donné son prénom en rejoignant, l'autre non.
insert into auth.users (id, email, is_anonymous)
values ('66666666-6666-6666-6666-666666666666', null, true),
       ('77777777-7777-7777-7777-777777777777', null, true);
update public.profiles set display_name = 'Inès'
 where id = '66666666-6666-6666-6666-666666666666';

do $$
begin
  if not (select is_anonymous from public.profiles where id = '66666666-6666-6666-6666-666666666666') then
    raise exception 'Un invité doit naître anonyme dans son profil';
  end if;
end $$;

-- Inès rattache Google : Supabase renseigne l'e-mail et le nom, et bascule
-- le drapeau.
update auth.users
   set email = 'ines@exemple.fr',
       raw_user_meta_data = '{"full_name": "Inès Martin", "avatar_url": "https://exemple.fr/ines.png"}',
       is_anonymous = false
 where id = '66666666-6666-6666-6666-666666666666';

-- L'autre rattache une adresse e-mail, sans nom.
update auth.users
   set email = 'voyageur.anonyme@exemple.fr', is_anonymous = false
 where id = '77777777-7777-7777-7777-777777777777';

do $$
declare
  ines public.profiles%rowtype;
  autre public.profiles%rowtype;
begin
  select * into ines from public.profiles where id = '66666666-6666-6666-6666-666666666666';
  select * into autre from public.profiles where id = '77777777-7777-7777-7777-777777777777';

  if ines.is_anonymous or autre.is_anonymous then
    raise exception 'Un invité devenu compte ne doit plus être anonyme dans son profil';
  end if;
  -- Le groupe la connaît sous « Inès » : Google ne la renomme pas.
  if ines.display_name <> 'Inès' then
    raise exception 'Le nom choisi a été écrasé : %', ines.display_name;
  end if;
  if ines.avatar_url is distinct from 'https://exemple.fr/ines.png' then
    raise exception 'La photo de Google aurait dû remplir un profil qui n''en avait pas';
  end if;
  -- Sans nom, le début de l'adresse en tient lieu.
  if autre.display_name <> 'voyageur.anonyme' then
    raise exception 'Un profil sans nom aurait dû prendre le début de l''adresse : %', autre.display_name;
  end if;
end $$;

-- Changer autre chose que le drapeau ne touche pas au profil.
update public.profiles set display_name = 'Inès M.'
 where id = '66666666-6666-6666-6666-666666666666';
update auth.users set raw_user_meta_data = '{"full_name": "Quelqu''un d''autre"}'
 where id = '66666666-6666-6666-6666-666666666666';

do $$
begin
  if (select display_name from public.profiles where id = '66666666-6666-6666-6666-666666666666') <> 'Inès M.' then
    raise exception 'Le profil ne doit suivre que le passage invité → compte';
  end if;
end $$;

-- Personne ne peut appeler la fonction du déclencheur à la main.
do $$
begin
  if has_function_privilege('authenticated', 'public.synchroniser_le_profil_du_compte()', 'execute') then
    raise exception 'La fonction du déclencheur ne doit pas être ouverte aux clients';
  end if;
end $$;

-- Ménage (le profil part avec le compte, en cascade) : les tests suivants
-- comptent les profils.
delete from auth.users where id in ('66666666-6666-6666-6666-666666666666', '77777777-7777-7777-7777-777777777777');

\echo '   compte invité devenu compte : ok'
