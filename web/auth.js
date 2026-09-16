// auth.js
// Fonctions d'authentification pour Kwata Shop.
// La ligne dans public.users est creee automatiquement cote base de donnees
// (voir kwata_shop_auth_trigger.sql) : ce fichier ne s'occupe que de l'inscription
// et de la connexion via Supabase Auth.

import { supabase } from './supabaseClient.js';

/**
 * Inscription d'un nouvel utilisateur (acheteur ou vendeur).
 * @param {Object} params
 * @param {string} params.email
 * @param {string} params.password
 * @param {string} params.fullName
 * @param {string} params.phone
 * @param {'acheteur'|'vendeur'} params.role
 * @returns {Promise<{user: object|null, error: string|null}>}
 */
export async function signUp({ email, password, fullName, phone, role }) {
  if (!email || !password) {
    return { user: null, error: 'Email et mot de passe sont obligatoires.' };
  }
  if (password.length < 8) {
    return { user: null, error: 'Le mot de passe doit contenir au moins 8 caracteres.' };
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      // raw_user_meta_data recupere par le trigger SQL pour remplir public.users
      data: {
        full_name: fullName ?? null,
        phone: phone ?? null,
        role: role === 'vendeur' ? 'vendeur' : 'acheteur',
      },
    },
  });

  if (error) {
    return { user: null, error: traduireErreur(error.message) };
  }

  return { user: data.user, error: null };
}

/**
 * Connexion d'un utilisateur existant.
 * @param {Object} params
 * @param {string} params.email
 * @param {string} params.password
 * @returns {Promise<{session: object|null, error: string|null}>}
 */
export async function signIn({ email, password }) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { session: null, error: traduireErreur(error.message) };
  }

  return { session: data.session, error: null };
}

/**
 * Deconnexion de l'utilisateur courant.
 */
export async function signOut() {
  const { error } = await supabase.auth.signOut();
  return { error: error ? error.message : null };
}

/**
 * Recupere le profil complet (role, boutique eventuelle) de l'utilisateur connecte.
 * Utile juste apres la connexion pour rediriger vers le bon tableau de bord.
 */
export async function getCurrentProfile() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile, error } = await supabase
    .from('users')
    .select('id, full_name, role, phone')
    .eq('id', user.id)
    .single();

  if (error) {
    console.error('Erreur de recuperation du profil :', error.message);
    return null;
  }

  return profile;
}

/**
 * Ecoute les changements de session (connexion/deconnexion) pour mettre
 * a jour l'interface en temps reel (ex. afficher/masquer les boutons).
 * @param {(session: object|null) => void} callback
 */
export function onAuthStateChange(callback) {
  return supabase.auth.onAuthStateChange((_event, session) => {
    callback(session);
  });
}

// Traduit les messages d'erreur Supabase les plus frequents en francais simple
function traduireErreur(message) {
  const traductions = {
    'Invalid login credentials': 'Email ou mot de passe incorrect.',
    'User already registered': 'Un compte existe deja avec cet email.',
    'Email not confirmed': 'Merci de confirmer ton email avant de te connecter.',
  };
  return traductions[message] ?? message;
}
