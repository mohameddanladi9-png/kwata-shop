-- =====================================================================
-- Kwata Shop — Journal d'audit automatique
-- A executer apres les scripts precedents.
-- Objectif : chaque changement de statut sensible (validation boutique,
-- moderation produit, resolution de litige) est trace automatiquement,
-- sans dependre du code cote client (qui pourrait oublier de le faire).
-- =====================================================================

-- Chaque action sensible a son propre trigger specifique (plus simple a lire
-- et a maintenir qu'une fonction generique en SQL dynamique). security definer
-- = la fonction peut ecrire dans audit_logs meme si la table n'autorise
-- aucune insertion directe par un client.

-- ---------------------------------------------------------------------
-- 1. Validation / suspension de boutique
-- ---------------------------------------------------------------------
create or replace function public.log_shop_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.verification_status is distinct from new.verification_status then
    insert into public.audit_logs (admin_id, action, target_type, target_id)
    values (auth.uid(), 'statut_boutique:' || old.verification_status || '->' || new.verification_status, 'shop', new.id);
  end if;
  return new;
end;
$$;

create trigger trg_log_shop_status
  after update on public.shops
  for each row execute function public.log_shop_status_change();

-- ---------------------------------------------------------------------
-- 2. Moderation de produit (changement de statut par l'admin)
-- ---------------------------------------------------------------------
create or replace function public.log_product_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.status is distinct from new.status and auth_role() = 'admin' then
    insert into public.audit_logs (admin_id, action, target_type, target_id)
    values (auth.uid(), 'statut_produit:' || old.status || '->' || new.status, 'product', new.id);
  end if;
  return new;
end;
$$;

create trigger trg_log_product_status
  after update on public.products
  for each row execute function public.log_product_status_change();

-- ---------------------------------------------------------------------
-- 3. Resolution de litige
-- ---------------------------------------------------------------------
create or replace function public.log_dispute_resolution()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.status is distinct from new.status then
    insert into public.audit_logs (admin_id, action, target_type, target_id)
    values (auth.uid(), 'statut_litige:' || old.status || '->' || new.status, 'dispute', new.id);
  end if;
  return new;
end;
$$;

create trigger trg_log_dispute_status
  after update on public.disputes
  for each row execute function public.log_dispute_resolution();
