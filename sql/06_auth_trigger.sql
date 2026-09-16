-- =====================================================================
-- Kwata Shop — Creation automatique du profil utilisateur (public.users)
-- A executer APRES kwata_shop_schema.sql et kwata_shop_rls_policies.sql
-- =====================================================================

-- Cette fonction s'execute avec les droits du proprietaire (postgres),
-- donc elle peut ecrire dans public.users malgre le RLS actif.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email, full_name, phone, role)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'phone',
    coalesce(new.raw_user_meta_data ->> 'role', 'acheteur')
  );
  return new;
end;
$$;

-- Le trigger se declenche a chaque nouvelle inscription via Supabase Auth
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();
