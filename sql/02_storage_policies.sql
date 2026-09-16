-- =====================================================================
-- Kwata Shop — Bucket de stockage pour les images produits
-- A executer dans l'editeur SQL de Supabase (ou via l'interface Storage)
-- =====================================================================

-- Cree le bucket "product-images" en lecture publique
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

-- Lecture publique des images (necessaire pour l'affichage du catalogue)
create policy "product_images_public_read" on storage.objects
  for select using (bucket_id = 'product-images');

-- Seul un vendeur connecte peut deposer une image, dans un dossier nomme
-- avec l'id de son propre produit (verifie via la table products)
create policy "product_images_seller_upload" on storage.objects
  for insert with check (
    bucket_id = 'product-images'
    and exists (
      select 1 from public.products p
      join public.shops s on s.id = p.shop_id
      where p.id::text = (storage.foldername(name))[1]
        and s.owner_id = auth.uid()
    )
  );

-- Un vendeur peut supprimer les images de ses propres produits
create policy "product_images_seller_delete" on storage.objects
  for delete using (
    bucket_id = 'product-images'
    and exists (
      select 1 from public.products p
      join public.shops s on s.id = p.shop_id
      where p.id::text = (storage.foldername(name))[1]
        and s.owner_id = auth.uid()
    )
  );
