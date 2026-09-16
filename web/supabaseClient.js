// supabaseClient.js
// Point d'entree unique vers Supabase pour tout le front-end de Kwata Shop.
// Remplace SUPABASE_URL et SUPABASE_ANON_KEY par les valeurs de ton projet
// (Project Settings > API dans le tableau de bord Supabase).
// La cle "anon" est publique par design : c'est le RLS qui protege les donnees,
// jamais cette cle. Ne mets jamais la cle "service_role" cote client.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = 'https://kmlijcijzvgzzzdiyeah.supabase.co';
const SUPABASE_ANON_KEY = 'REMPLACE_PAR_TA_CLE_ANON_PUBLIQUE';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
