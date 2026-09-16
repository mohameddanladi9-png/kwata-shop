// shops.js
// Gestion des boutiques vendeurs pour Kwata Shop.

import { supabase } from './supabaseClient.js';

/**
 * Cree la boutique du vendeur connecte. Statut initial : "en_attente"
 * (RLS empeche le vendeur de se valider lui-meme, voir kwata_shop_rls_policies.sql).
 */
export async function createShop({ name, type, description }) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { shop: null, error: 'Tu dois etre connecte pour creer une boutique.' };

  const { data, error } = await supabase
    .from('shops')
    .insert({ owner_id: user.id, name, type, description })
    .select()
    .single();

  if (error) return { shop: null, error: error.message };
  return { shop: data, error: null };
}

/**
 * Recupere la boutique du vendeur connecte (null s'il n'en a pas encore).
 */
export async function getMyShop() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('shops')
    .select('*')
    .eq('owner_id', user.id)
    .maybeSingle();

  if (error) {
    console.error('Erreur de recuperation de la boutique :', error.message);
    return null;
  }
  return data;
}

/**
 * Met a jour les informations de la boutique (nom, description).
 * Ne permet jamais de modifier verification_status : c'est bloque par le RLS.
 */
export async function updateShop(shopId, { name, description }) {
  const { data, error } = await supabase
    .from('shops')
    .update({ name, description })
    .eq('id', shopId)
    .select()
    .single();

  if (error) return { shop: null, error: error.message };
  return { shop: data, error: null };
}
