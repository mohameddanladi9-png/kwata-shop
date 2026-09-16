-- =====================================================================
-- Kwata Shop — Correctif RLS : insertion des lignes de commande par l'acheteur
-- A executer apres kwata_shop_rls_policies.sql (corrige un oubli de ce script :
-- order_items n'avait aucune politique d'insertion pour l'acheteur).
-- =====================================================================

create policy "order_items_insert_buyer" on public.order_items
  for insert with check (
    exists (
      select 1 from public.orders o
      where o.id = order_items.order_id and o.buyer_id = auth.uid()
    )
  );
