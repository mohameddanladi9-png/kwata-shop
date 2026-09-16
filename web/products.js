// products.js
// Gestion des produits (cote vendeur) et du catalogue public (cote acheteur).

import { supabase } from './supabaseClient.js';

/**
 * Ajoute un produit a la boutique du vendeur connecte.
 */
export async function createProduct(shopId, {
  name, description, categoryId, priceRetail, priceWholesale, minWholesaleQty, stock,
}) {
  const { data, error } = await supabase
    .from('products')
    .insert({
      shop_id: shopId,
      category_id: categoryId ?? null,
      name,
      description,
      price_retail: priceRetail,
      price_wholesale: priceWholesale ?? null,
      min_wholesale_qty: minWholesaleQty ?? null,
      stock: stock ?? 0,
    })
    .select()
    .single();

  if (error) return { product: null, error: error.message };
  return { product: data, error: null };
}

/**
 * Envoie une image de produit dans le bucket "product-images" et l'associe au produit.
 * @param {string} productId
 * @param {File} file - fichier image choisi par l'utilisateur (input type="file")
 * @param {number} position - ordre d'affichage (0 = photo principale)
 */
export async function uploadProductImage(productId, file, position = 0) {
  const filePath = `${productId}/${Date.now()}-${file.name}`;

  const { error: uploadError } = await supabase.storage
    .from('product-images')
    .upload(filePath, file);

  if (uploadError) return { url: null, error: uploadError.message };

  const { data: { publicUrl } } = supabase.storage
    .from('product-images')
    .getPublicUrl(filePath);

  const { error: insertError } = await supabase
    .from('product_images')
    .insert({ product_id: productId, url: publicUrl, position });

  if (insertError) return { url: null, error: insertError.message };
  return { url: publicUrl, error: null };
}

/**
 * Liste les produits de la boutique du vendeur connecte (y compris inactifs).
 */
export async function listMyProducts(shopId) {
  const { data, error } = await supabase
    .from('products')
    .select('*, product_images(url, position)')
    .eq('shop_id', shopId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Erreur de recuperation des produits :', error.message);
    return [];
  }
  return data;
}

/**
 * Met a jour le stock, le prix ou le statut d'un produit.
 */
export async function updateProduct(productId, changes) {
  const { data, error } = await supabase
    .from('products')
    .update(changes)
    .eq('id', productId)
    .select()
    .single();

  if (error) return { product: null, error: error.message };
  return { product: data, error: null };
}

/**
 * Recupere un produit actif avec ses images, variantes, sa boutique et ses avis.
 * Utilise pour la page fiche produit.
 */
export async function getProductById(productId) {
  const { data, error } = await supabase
    .from('products')
    .select(`
      *,
      product_images(url, position),
      product_variants(id, name, price_delta, stock),
      shops(id, name, rating_avg, verification_status),
      reviews(rating, comment, created_at)
    `)
    .eq('id', productId)
    .eq('status', 'actif')
    .single();

  if (error) {
    console.error('Erreur de recuperation du produit :', error.message);
    return null;
  }
  return data;
}

/**
 * Catalogue public : produits actifs, avec recherche et filtre par categorie.
 * @param {Object} params
 * @param {string} [params.search] - recherche sur le nom du produit
 * @param {string} [params.categoryId]
 * @param {number} [params.page] - pagination, commence a 0
 * @param {number} [params.pageSize]
 */
export async function listCatalogue({ search, categoryId, page = 0, pageSize = 20 } = {}) {
  let query = supabase
    .from('products')
    .select('*, product_images(url, position), shops(name, rating_avg)', { count: 'exact' })
    .eq('status', 'actif')
    .range(page * pageSize, page * pageSize + pageSize - 1)
    .order('created_at', { ascending: false });

  if (search) {
    query = query.ilike('name', `%${search}%`);
  }
  if (categoryId) {
    query = query.eq('category_id', categoryId);
  }

  const { data, error, count } = await query;

  if (error) {
    console.error('Erreur de recuperation du catalogue :', error.message);
    return { products: [], total: 0 };
  }
  return { products: data, total: count };
}
