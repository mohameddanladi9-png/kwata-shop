// supabase/functions/create-payment/index.ts
//
// Fonction Edge (Deno) qui initie un paiement Mobile Money via l'agregateur CinetPay.
// C'est la SEULE partie du systeme autorisee a ecrire dans la table "payments",
// car elle utilise la cle service_role (jamais exposee au navigateur).
//
// Variables d'environnement a configurer dans Supabase
// (Project Settings > Edge Functions > Secrets) :
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY  (fournies automatiquement par Supabase)
//   CINETPAY_API_KEY, CINETPAY_SITE_ID       (a recuperer sur ton compte CinetPay)
//   CINETPAY_NOTIFY_URL                       (URL de la fonction payment-webhook, etape suivante)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CINETPAY_API_URL = 'https://api-checkout.cinetpay.com/v2/payment';

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Methode non autorisee', { status: 405 });
  }

  try {
    const { orderId, provider, phone } = await req.json();

    if (!orderId || !provider || !phone) {
      return jsonResponse({ error: 'orderId, provider et phone sont obligatoires.' }, 400);
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL'),
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
    );

    // Recupere la commande pour connaitre le montant exact (jamais fourni par le client)
    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .select('id, total_amount, currency, buyer_id, status')
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      return jsonResponse({ error: 'Commande introuvable.' }, 404);
    }
    if (order.status !== 'en_attente') {
      return jsonResponse({ error: 'Cette commande a deja ete traitee.' }, 409);
    }

    const transactionRef = `KW-${orderId}-${Date.now()}`;

    // Cree la ligne de paiement en statut "en_attente" avant meme la reponse de CinetPay
    const { error: paymentInsertError } = await supabaseAdmin
      .from('payments')
      .insert({
        order_id: orderId,
        provider,
        status: 'en_attente',
        amount: order.total_amount,
        transaction_ref: transactionRef,
      });

    if (paymentInsertError) {
      return jsonResponse({ error: paymentInsertError.message }, 500);
    }

    // Appel a l'API CinetPay pour initier le paiement Mobile Money
    const reponseCinetpay = await fetch(CINETPAY_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        apikey: Deno.env.get('CINETPAY_API_KEY'),
        site_id: Deno.env.get('CINETPAY_SITE_ID'),
        transaction_id: transactionRef,
        amount: order.total_amount,
        currency: order.currency || 'XAF',
        description: `Commande Kwata Shop #${orderId}`,
        customer_phone_number: phone,
        notify_url: Deno.env.get('CINETPAY_NOTIFY_URL'),
        channels: provider === 'orange_money' ? 'MOBILE_MONEY' : 'MOBILE_MONEY',
      }),
    });

    const resultat = await reponseCinetpay.json();

    if (resultat.code !== '201') {
      await supabaseAdmin
        .from('payments')
        .update({ status: 'echoue' })
        .eq('transaction_ref', transactionRef);

      return jsonResponse({ error: resultat.message ?? 'Echec de l\'initiation du paiement.' }, 502);
    }

    // paymentUrl : lien ou code USSD a afficher/rediriger cote client selon CinetPay
    return jsonResponse({
      paymentUrl: resultat.data.payment_url,
      transactionRef,
    });
  } catch (err) {
    return jsonResponse({ error: err.message }, 500);
  }
});

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
