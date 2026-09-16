# Kwata Shop — Dossier complet du projet

## Structure

- **documents/** — Cahier des charges et guide de déploiement (Word)
- **sql/** — Scripts à exécuter dans l'éditeur SQL de Supabase, **dans l'ordre numéroté** (01 à 06)
- **web/** — Pages et modules JavaScript du site (à héberger ensemble, ex. Vercel/Netlify)
- **edge-functions/** — Fonctions Supabase Edge (paiement Mobile Money), à déployer avec la CLI Supabase

## Avant de commencer

1. Dans `web/supabaseClient.js`, remplace `SUPABASE_ANON_KEY` par ta vraie clé (Project Settings > API dans Supabase).
2. Exécute les scripts du dossier `sql/` un par un, dans l'ordre numéroté, dans l'éditeur SQL de Supabase.
3. Configure les secrets des fonctions Edge (Project Settings > Edge Functions > Secrets) :
   `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `CINETPAY_API_KEY`, `CINETPAY_SITE_ID`, `CINETPAY_NOTIFY_URL`
4. Déploie les fonctions Edge :
   ```
   supabase functions deploy create-payment
   supabase functions deploy payment-webhook
   ```
5. Depuis le dossier `web/`, lance un serveur local pour tester (les modules ES ne fonctionnent pas en `file://`) :
   ```
   npx serve .
   ```

## Parcours à tester

`inscription.html` → `connexion.html` → créer une boutique/un produit (console navigateur, pas encore de page dédiée) → `catalogue.html` → `produit.html` → `panier.html` → `paiement.html` → `dashboard-vendeur.html` (côté vendeur) → `admin.html` (après avoir passé un compte en rôle `admin` directement dans Supabase)

## Obtenir un vrai .apk (Android) et .exe (Windows)

Je ne peux pas compiler ces binaires directement dans mon environnement (il faudrait le SDK Android complet ou une chaîne de compilation Windows). Voici le chemin réaliste, gratuit, pour les deux :

### .apk Android — via PWABuilder (aucun code à écrire)

1. Déploie le contenu de `web/` sur un hébergement (Vercel/Netlify) — `manifest.json` et `sw.js` sont déjà en place pour rendre le site installable.
2. Va sur https://www.pwabuilder.com, colle l'URL de ton site déployé.
3. PWABuilder analyse le site et génère un `.apk` (ou `.aab` pour le Play Store) signé, prêt à installer ou publier.
4. Avant de générer, prépare de vraies icônes 192x192 et 512x512 dans `web/icons/` (des carrés simples suffisent pour commencer) — `manifest.json` les référence déjà.

### .exe Windows (et .dmg Mac, .AppImage Linux) — via Electron + GitHub Actions

Le dossier `desktop/` contient une application Electron minimale qui affiche ton site dans une fenêtre native.

1. Dans `desktop/main.js`, remplace `SITE_URL` par l'URL réelle de ton site déployé.
2. Pousse ce projet (dossier entier, `.github/` inclus) sur un dépôt GitHub.
3. Le workflow `.github/workflows/build-desktop.yml` se déclenche automatiquement à chaque envoi sur `main` et compile un vrai `.exe`, `.dmg` et `.AppImage` — récupérables dans l'onglet **Actions** du dépôt, section **Artifacts**, sans avoir besoin d'un PC Windows.
4. Si tu préfères compiler en local (sur ta machine) : `cd desktop && npm install && npm run build`.



V1 fonctionnelle : authentification, catalogue, panier, commande, paiement Mobile Money (via CinetPay), tableau de bord vendeur, espace admin, sécurité RLS avec journal d'audit automatique.

Pages encore à créer : création de boutique et gestion de produits côté vendeur (formulaires), sélection d'adresse de livraison dans le panier (actuellement un `prompt()` temporaire).

Feuille de route V2/V3 détaillée dans le cahier des charges (section 6).
