// orders.js
// Transforme le panier en commande reelle dans Supabase.
// Une seule commande (orders) est creee, avec une ligne order_items par produit —
// le shop_id est copie sur chaque ligne pour que le RLS vendeur fonctionne
// (voir kwata_shop_rls_policies.sql).

import { supabase } from './supabaseClient.js';

/**
 * Cree une commande a partir des articles du panier.
 * @param {Array} articlesPanier - voir la structure dans cart.js
 * @param {string} addressId - id d'une adresse existante du buyer
 * @returns {Promise<{order: object|null, error: string|null}>}
 */
export async function creerCommande(articlesPanier, addressId) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { order: null, error: 'Tu dois etre connecte pour commander.' };

  if (!articlesPanier || articlesPanier.length === 0) {
    return { order: null, error: 'Le panier est vide.' };
  }

  const total = articlesPanier.reduce((t, a) => t + a.unitPrice * a.quantity, 0);

  // 1. Creer la commande
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .insert({
      buyer_id: user.id,
      address_id: addressId,
      total_amount: total,
      status: 'en_attente',
    })
    .select()
    .single();

  if (orderError) return { order: null, error: orderError.message };

  // 2. Creer une ligne order_items par produit
  const lignes = articlesPanier.map((a) => ({
    order_id: order.id,
    product_id: a.productId,
    shop_id: a.shopId,
    quantity: a.quantity,
    unit_price: a.unitPrice,
  }));

  const { error: itemsError } = await supabase.from('order_items').insert(lignes);

  if (itemsError) {
    // La commande a ete creee mais sans lignes : on la marque annulee pour eviter
    // une commande fantome. Le nettoyage complet (rollback) doit idealement se
    // faire via une fonction Edge transactionnelle en production.
    await supabase.from('orders').update({ status: 'annulee' }).eq('id', order.id);
    return { order: null, error: itemsError.message };
  }

  return { order, error: null };
}

/**
 * Recupere une commande avec ses lignes, pour la page de suivi/paiement.
 */
export async function getCommande(orderId) {
  const { data, error } = await supabase
    .from('orders')
    .select('*, order_items(*, products(name)), payments(*)')
    .eq('id', orderId)
    .single();

  if (error) {
    console.error('Erreur de recuperation de la commande :', error.message);
    return null;
  }
  return data;
}
