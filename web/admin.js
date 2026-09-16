// admin.js
// Fonctions reservees a l'administrateur. Le RLS (shops_admin_all, products_admin_all,
// disputes_admin_all...) garantit qu'un utilisateur sans role "admin" dans public.users
// ne peut rien lire ni modifier via ces memes appels : la protection est en base,
// pas seulement dans ce fichier.

import { supabase } from './supabaseClient.js';

/**
 * Boutiques en attente ou partiellement verifiees, a examiner en priorite.
 */
export async function listBoutiquesAValider() {
  const { data, error } = await supabase
    .from('shops')
    .select('id, name, type, verification_status, owner_id, users(full_name, email)')
    .in('verification_status', ['en_attente', 'partiel'])
    .order('id', { ascending: true });

  if (error) {
    console.error('Erreur de recuperation des boutiques :', error.message);
    return [];
  }
  return data;
}

export async function validerBoutique(shopId) {
  const { error } = await supabase
    .from('shops')
    .update({ verification_status: 'valide' })
    .eq('id', shopId);
  return { error: error?.message ?? null };
}

export async function suspendreBoutique(shopId) {
  const { error } = await supabase
    .from('shops')
    .update({ verification_status: 'suspendu' })
    .eq('id', shopId);
  return { error: error?.message ?? null };
}

/**
 * Produits signales ou recemment ajoutes, pour moderation.
 */
export async function listProduitsAModerer({ limite = 50 } = {}) {
  const { data, error } = await supabase
    .from('products')
    .select('id, name, status, shops(name)')
    .order('created_at', { ascending: false })
    .limit(limite);

  if (error) {
    console.error('Erreur de recuperation des produits :', error.message);
    return [];
  }
  return data;
}

export async function retirerProduit(productId) {
  const { error } = await supabase
    .from('products')
    .update({ status: 'inactif' })
    .eq('id', productId);
  return { error: error?.message ?? null };
}

/**
 * Litiges ouverts, avec les informations de la commande concernee.
 */
export async function listLitiges({ statut } = {}) {
  let query = supabase
    .from('disputes')
    .select('id, reason, status, created_at, orders(id, total_amount, buyer_id)')
    .order('created_at', { ascending: false });

  if (statut) query = query.eq('status', statut);

  const { data, error } = await query;

  if (error) {
    console.error('Erreur de recuperation des litiges :', error.message);
    return [];
  }
  return data;
}

export async function resoudreLitige(disputeId, resolution) {
  const { error } = await supabase
    .from('disputes')
    .update({ status: 'resolu', resolution })
    .eq('id', disputeId);
  return { error: error?.message ?? null };
}

/**
 * Journal d'audit (lecture seule pour l'admin — l'ecriture se fait par triggers SQL).
 */
export async function listJournalAudit({ limite = 100 } = {}) {
  const { data, error } = await supabase
    .from('audit_logs')
    .select('*, users(full_name)')
    .order('created_at', { ascending: false })
    .limit(limite);

  if (error) {
    console.error('Erreur de recuperation du journal d\'audit :', error.message);
    return [];
  }
  return data;
}
