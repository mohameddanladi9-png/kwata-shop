// supabase/functions/payment-webhook/index.ts
//
// Recoit la notification de CinetPay apres qu'un paiement Mobile Money a ete
// confirme ou refuse par l'utilisateur (validation du code USSD/PIN sur son telephone).
// C'est cette fonction qui fait officiellement passer la commande de "en_attente" a "confirmee".
//
// A configurer comme CINETPAY_NOTIFY_URL dans create-payment/index.ts :
// https://<ton-projet>.supabase.co/functions/v1/payment-webhook

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Methode non autorisee', { status: 405 });
  }

  try {
    const notification = await req.json();
    const transactionRef = notification.cpm_trans_id ?? notification.transaction_id;

    if (!transactionRef) {
      return new Response('transaction_id manquant', { status: 400 });
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL'),
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
    );

    // Important : on reverifie le statut aupres de CinetPay plutot que de faire
    // confiance aveuglement au contenu du webhook (recommandation anti-fraude CinetPay).
    const verification = await fetch('https://api-checkout.cinetpay.com/v2/payment/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        apikey: Deno.env.get('CINETPAY_API_KEY'),
        site_id: Deno.env.get('CINETPAY_SITE_ID'),
        transaction_id: transactionRef,
      }),
    });
    const resultatVerif = await verification.json();
    const paiementConfirme = resultatVerif.data?.status === 'ACCEPTED';

    const { data: payment } = await supabaseAdmin
      .from('payments')
      .select('id, order_id')
      .eq('transaction_ref', transactionRef)
      .single();

    if (!payment) {
      return new Response('Paiement inconnu', { status: 404 });
    }

    await supabaseAdmin
      .from('payments')
      .update({ status: paiementConfirme ? 'confirme' : 'echoue' })
      .eq('id', payment.id);

    if (paiementConfirme) {
      await supabaseAdmin
        .from('orders')
        .update({ status: 'confirmee' })
        .eq('id', payment.order_id);

      await supabaseAdmin.from('audit_logs').insert({
        action: 'paiement_confirme',
        target_type: 'order',
        target_id: payment.order_id,
      });
    }

    return new Response('OK', { status: 200 });
  } catch (err) {
    return new Response(`Erreur : ${err.message}`, { status: 500 });
  }
});
