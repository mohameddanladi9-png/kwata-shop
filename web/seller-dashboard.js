// seller-dashboard.js
// Statistiques et gestion des commandes pour l'espace vendeur.
// Le RLS garantit deja qu'un vendeur ne recupere que ses propres donnees
// (voir products_select_owner, order_items_select_seller dans les politiques RLS) :
// ces fonctions n'ont donc pas besoin de filtrer manuellement par shop_id cote client.

import { supabase } from './supabaseClient.js';

/**
 * Statistiques resumees pour la carte du haut du tableau de bord.
 */
export async function getStatsVendeur(shopId) {
  const debutMois = new Date();
  debutMois.setDate(1);
  debutMois.setHours(0, 0, 0, 0);

  const { data: lignesDuMois } = await supabase
    .from('order_items')
    .select('quantity, unit_price, status, orders!inner(created_at)')
    .eq('shop_id', shopId)
    .gte('orders.created_at', debutMois.toISOString());

  const ventesDuMois = (lignesDuMois || []).reduce((t, l) => t + l.quantity * l.unit_price, 0);
  const nbCommandes = new Set((lignesDuMois || []).map((l) => l.orders?.created_at)).size;
  const enAttente = (lignesDuMois || []).filter((l) => l.status === 'en_attente').length;

  const { data: shop } = await supabase
    .from('shops')
    .select('rating_avg, verification_status')
    .eq('id', shopId)
    .single();

  return {
    ventesDuMois,
    nbCommandes,
    enAttente,
    noteMoyenne: shop?.rating_avg ?? 0,
    statutVerification: shop?.verification_status ?? 'en_attente',
  };
}

/**
 * Liste les commandes recentes concernant ce vendeur, avec le nom du produit et de l'acheteur.
 */
export async function listCommandesVendeur(shopId, { limite = 20 } = {}) {
  const { data, error } = await supabase
    .from('order_items')
    .select('id, quantity, unit_price, status, products(name), orders(id, created_at, buyer_id, users(full_name))')
    .eq('shop_id', shopId)
    .order('id', { ascending: false })
    .limit(limite);

  if (error) {
    console.error('Erreur de recuperation des commandes :', error.message);
    return [];
  }
  return data;
}

/**
 * Met a jour le statut de preparation d'une ligne de commande
 * (en_attente -> a_expedier -> expediee -> livree).
 */
export async function mettreAJourStatutLigne(orderItemId, statut) {
  const { error } = await supabase
    .from('order_items')
    .update({ status: statut })
    .eq('id', orderItemId);

  return { error: error?.message ?? null };
}
