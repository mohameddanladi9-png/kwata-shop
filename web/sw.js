// sw.js — Service worker minimal de Kwata Shop.
// Objectif : rendre le site "installable" (condition technique exigee par
// PWABuilder et par Chrome/Android pour proposer "Ajouter a l'ecran d'accueil"),
// et permettre un affichage basique hors-ligne des pages deja visitees.
// Ce n'est pas une strategie de cache avancee : suffisant pour la V1.

const CACHE_NAME = 'kwata-shop-v1';
const FICHIERS_A_METTRE_EN_CACHE = [
  './',
  './catalogue.html',
  './produit.html',
  './panier.html',
  './manifest.json',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(FICHIERS_A_METTRE_EN_CACHE))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((noms) =>
      Promise.all(noms.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))
    )
  );
  self.clients.claim();
});

// Strategie "network first" : essaie le reseau (donnees a jour), retombe sur
// le cache si hors-ligne. Adapte a un site qui affiche des donnees live (Supabase).
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    fetch(event.request)
      .then((reponse) => {
        const copie = reponse.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copie));
        return reponse;
      })
      .catch(() => caches.match(event.request))
  );
});
