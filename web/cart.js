// cart.js
// Panier cote client, stocke dans localStorage (persiste entre les visites,
// pas besoin d'etre connecte pour ajouter au panier — seulement pour commander).
// Le panier regroupe les articles par boutique, car chaque vendeur genere
// sa propre ligne de commande (voir order_items dans le schema).

const CLE_STOCKAGE = 'kwata_shop_panier';

/**
 * Structure d'un article de panier :
 * { productId, shopId, shopName, name, unitPrice, currency, quantity, imageUrl }
 */

function lirePanier() {
  try {
    return JSON.parse(localStorage.getItem(CLE_STOCKAGE)) ?? [];
  } catch {
    return [];
  }
}

function ecrirePanier(articles) {
  localStorage.setItem(CLE_STOCKAGE, JSON.stringify(articles));
  document.dispatchEvent(new CustomEvent('panier:maj', { detail: articles }));
}

export function getPanier() {
  return lirePanier();
}

export function ajouterAuPanier(article, quantite = 1) {
  const articles = lirePanier();
  const existant = articles.find((a) => a.productId === article.productId);

  if (existant) {
    existant.quantity += quantite;
  } else {
    articles.push({ ...article, quantity: quantite });
  }

  ecrirePanier(articles);
  return articles;
}

export function modifierQuantite(productId, quantite) {
  let articles = lirePanier();

  if (quantite <= 0) {
    articles = articles.filter((a) => a.productId !== productId);
  } else {
    const article = articles.find((a) => a.productId === productId);
    if (article) article.quantity = quantite;
  }

  ecrirePanier(articles);
  return articles;
}

export function retirerDuPanier(productId) {
  const articles = lirePanier().filter((a) => a.productId !== productId);
  ecrirePanier(articles);
  return articles;
}

export function viderPanier() {
  ecrirePanier([]);
}

/**
 * Regroupe les articles par boutique, car une commande genere
 * une ligne order_items par boutique concernee.
 */
export function grouperParBoutique() {
  const articles = lirePanier();
  const groupes = {};

  for (const article of articles) {
    if (!groupes[article.shopId]) {
      groupes[article.shopId] = { shopId: article.shopId, shopName: article.shopName, articles: [] };
    }
    groupes[article.shopId].articles.push(article);
  }

  return Object.values(groupes);
}

export function calculerTotal() {
  return lirePanier().reduce((total, a) => total + a.unitPrice * a.quantity, 0);
}
