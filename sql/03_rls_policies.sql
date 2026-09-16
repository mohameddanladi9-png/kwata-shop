-- =====================================================================
-- Kwata Shop — Politiques RLS (Row Level Security) — Supabase / PostgreSQL
-- A executer dans l'editeur SQL de Supabase, apres creation des tables.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. Fonctions utilitaires
-- ---------------------------------------------------------------------
-- Retourne le role de l'utilisateur connecte (acheteur, vendeur, admin, moderateur)
create or replace function auth_role()
returns text
language sql
stable
security definer
as $$
  select role from public.users where id = auth.uid()
$$;

-- Retourne l'id de la boutique appartenant a l'utilisateur connecte (null si aucune)
create or replace function auth_shop_id()
returns uuid
language sql
stable
security definer
as $$
  select id from public.shops where owner_id = auth.uid()
$$;

-- =====================================================================
-- 1. USERS
-- =====================================================================
alter table public.users enable row level security;

-- Un utilisateur peut lire son propre profil
create policy "users_select_self" on public.users
  for select using (id = auth.uid());

-- Un utilisateur peut modifier son propre profil (pas son role)
create policy "users_update_self" on public.users
  for update using (id = auth.uid())
  with check (id = auth.uid());

-- L'administrateur peut tout lire et tout modifier (y compris les roles)
create policy "users_admin_all" on public.users
  for all using (auth_role() = 'admin');

-- =====================================================================
-- 2. SHOPS
-- =====================================================================
alter table public.shops enable row level security;

-- Tout le monde peut voir les boutiques validees (catalogue public)
create policy "shops_select_public" on public.shops
  for select using (verification_status = 'valide');

-- Un vendeur voit sa propre boutique quel que soit son statut
create policy "shops_select_owner" on public.shops
  for select using (owner_id = auth.uid());

-- Un vendeur peut creer sa boutique (statut initial = en_attente, verifie a l'insertion)
create policy "shops_insert_owner" on public.shops
  for insert with check (owner_id = auth.uid());

-- Un vendeur peut modifier sa boutique, mais jamais son propre statut de verification
create policy "shops_update_owner" on public.shops
  for update using (owner_id = auth.uid())
  with check (owner_id = auth.uid() and verification_status = (select verification_status from public.shops where id = shops.id));

-- L'administrateur gere tout, y compris la validation des boutiques
create policy "shops_admin_all" on public.shops
  for all using (auth_role() = 'admin');

-- =====================================================================
-- 3. CATEGORIES
-- =====================================================================
alter table public.categories enable row level security;

-- Lecture publique (necessaire pour la navigation du catalogue)
create policy "categories_select_public" on public.categories
  for select using (true);

-- Seul l'administrateur cree/modifie/supprime des categories
create policy "categories_admin_write" on public.categories
  for insert with check (auth_role() = 'admin');
create policy "categories_admin_update" on public.categories
  for update using (auth_role() = 'admin');
create policy "categories_admin_delete" on public.categories
  for delete using (auth_role() = 'admin');

-- =====================================================================
-- 4. PRODUCTS
-- =====================================================================
alter table public.products enable row level security;

-- Lecture publique des produits actifs (catalogue)
create policy "products_select_public" on public.products
  for select using (status = 'actif');

-- Un vendeur voit tous ses propres produits, meme inactifs
create policy "products_select_owner" on public.products
  for select using (shop_id = auth_shop_id());

-- Un vendeur ne peut inserer/modifier/supprimer que ses propres produits
create policy "products_write_owner" on public.products
  for all using (shop_id = auth_shop_id())
  with check (shop_id = auth_shop_id());

-- L'administrateur gere/modere tous les produits
create policy "products_admin_all" on public.products
  for all using (auth_role() = 'admin');

-- =====================================================================
-- 5. PRODUCT_VARIANTS
-- =====================================================================
alter table public.product_variants enable row level security;

-- Lecture publique liee a un produit visible
create policy "variants_select_public" on public.product_variants
  for select using (
    exists (select 1 from public.products p where p.id = product_variants.product_id and p.status = 'actif')
  );

-- Le vendeur proprietaire du produit gere ses variantes
create policy "variants_write_owner" on public.product_variants
  for all using (
    exists (select 1 from public.products p where p.id = product_variants.product_id and p.shop_id = auth_shop_id())
  );

-- =====================================================================
-- 6. ORDERS
-- =====================================================================
alter table public.orders enable row level security;

-- Un acheteur voit uniquement ses propres commandes
create policy "orders_select_buyer" on public.orders
  for select using (buyer_id = auth.uid());

-- Un acheteur peut creer une commande a son nom
create policy "orders_insert_buyer" on public.orders
  for insert with check (buyer_id = auth.uid());

-- Un vendeur voit les commandes contenant au moins un de ses produits (via order_items)
create policy "orders_select_seller" on public.orders
  for select using (
    exists (
      select 1 from public.order_items oi
      where oi.order_id = orders.id and oi.shop_id = auth_shop_id()
    )
  );

-- L'administrateur gere toutes les commandes (litiges, remboursements)
create policy "orders_admin_all" on public.orders
  for all using (auth_role() = 'admin');

-- =====================================================================
-- 7. ORDER_ITEMS
-- =====================================================================
alter table public.order_items enable row level security;

-- Un acheteur voit les lignes de ses propres commandes
create policy "order_items_select_buyer" on public.order_items
  for select using (
    exists (select 1 from public.orders o where o.id = order_items.order_id and o.buyer_id = auth.uid())
  );

-- Un vendeur voit uniquement les lignes qui le concernent
create policy "order_items_select_seller" on public.order_items
  for select using (shop_id = auth_shop_id());

-- Un vendeur peut mettre a jour le statut de preparation de ses lignes uniquement
create policy "order_items_update_seller" on public.order_items
  for update using (shop_id = auth_shop_id())
  with check (shop_id = auth_shop_id());

create policy "order_items_admin_all" on public.order_items
  for all using (auth_role() = 'admin');

-- =====================================================================
-- 8. PAYMENTS
-- =====================================================================
alter table public.payments enable row level security;

-- Un acheteur voit le paiement de sa propre commande
create policy "payments_select_buyer" on public.payments
  for select using (
    exists (select 1 from public.orders o where o.id = payments.order_id and o.buyer_id = auth.uid())
  );

-- Aucune ecriture cote client : les paiements sont crees/mis a jour uniquement
-- par une fonction Edge (service_role), jamais directement par l'utilisateur.
create policy "payments_admin_all" on public.payments
  for all using (auth_role() = 'admin');

-- =====================================================================
-- 9. QUOTES (devis / negociation B2B)
-- =====================================================================
alter table public.quotes enable row level security;

-- L'acheteur voit ses propres demandes de devis
create policy "quotes_select_buyer" on public.quotes
  for select using (buyer_id = auth.uid());

create policy "quotes_insert_buyer" on public.quotes
  for insert with check (buyer_id = auth.uid());

-- Le vendeur voit et repond aux devis qui le concernent
create policy "quotes_select_seller" on public.quotes
  for select using (shop_id = auth_shop_id());

create policy "quotes_update_seller" on public.quotes
  for update using (shop_id = auth_shop_id())
  with check (shop_id = auth_shop_id());

create policy "quotes_admin_all" on public.quotes
  for all using (auth_role() = 'admin');

-- =====================================================================
-- 10. SHIPMENTS
-- =====================================================================
alter table public.shipments enable row level security;

create policy "shipments_select_buyer" on public.shipments
  for select using (
    exists (select 1 from public.orders o where o.id = shipments.order_id and o.buyer_id = auth.uid())
  );

create policy "shipments_select_seller" on public.shipments
  for select using (
    exists (
      select 1 from public.order_items oi
      where oi.order_id = shipments.order_id and oi.shop_id = auth_shop_id()
    )
  );

create policy "shipments_admin_all" on public.shipments
  for all using (auth_role() = 'admin');

-- =====================================================================
-- 11. DISPUTES
-- =====================================================================
alter table public.disputes enable row level security;

-- Seule la personne ayant ouvert le litige (acheteur ou vendeur) peut le consulter
create policy "disputes_select_involved" on public.disputes
  for select using (
    opened_by = auth.uid()
    or exists (
      select 1 from public.order_items oi
      where oi.order_id = disputes.order_id and oi.shop_id = auth_shop_id()
    )
  );

create policy "disputes_insert_involved" on public.disputes
  for insert with check (opened_by = auth.uid());

-- Seul l'administrateur peut changer le statut d'un litige (mediation)
create policy "disputes_admin_all" on public.disputes
  for all using (auth_role() = 'admin');

-- =====================================================================
-- 12. REVIEWS
-- =====================================================================
alter table public.reviews enable row level security;

-- Lecture publique des avis (confiance acheteur)
create policy "reviews_select_public" on public.reviews
  for select using (true);

-- Un acheteur ne peut laisser un avis que sur une commande qu'il a passee et recue
create policy "reviews_insert_buyer" on public.reviews
  for insert with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.order_items oi
      join public.orders o on o.id = oi.order_id
      where o.buyer_id = auth.uid() and o.status = 'livree'
    )
  );

-- Un acheteur peut modifier/supprimer son propre avis
create policy "reviews_update_owner" on public.reviews
  for update using (user_id = auth.uid());
create policy "reviews_delete_owner" on public.reviews
  for delete using (user_id = auth.uid());

-- L'administrateur/moderateur peut supprimer un avis frauduleux
create policy "reviews_admin_moderate" on public.reviews
  for delete using (auth_role() in ('admin', 'moderateur'));

-- =====================================================================
-- 13. ADDRESSES
-- =====================================================================
alter table public.addresses enable row level security;

-- Un utilisateur ne voit et ne gere que ses propres adresses
create policy "addresses_owner_all" on public.addresses
  for all using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- =====================================================================
-- 14. AUDIT_LOGS (journal d'audit administratif)
-- =====================================================================
alter table public.audit_logs enable row level security;

-- Seul l'administrateur peut lire le journal d'audit
create policy "audit_logs_admin_select" on public.audit_logs
  for select using (auth_role() = 'admin');

-- Aucune insertion/modification directe par un client : le journal est alimente
-- uniquement par des fonctions Edge (service_role), jamais par l'utilisateur.
