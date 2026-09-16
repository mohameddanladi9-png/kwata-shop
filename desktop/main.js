// main.js — point d'entree Electron.
// Cree une fenetre desktop qui affiche le site Kwata Shop.
//
// Deux modes possibles :
//   1. Charger le site deja deploye en ligne (recommande : toujours a jour,
//      paiements et base de donnees fonctionnent normalement).
//   2. Charger les fichiers locaux du dossier web/ (utile pour tester sans
//      hebergement, mais les appels a Supabase necessitent quand meme internet).
//
// Par defaut, ce fichier charge l'URL en ligne. Remplace SITE_URL si besoin.

const { app, BrowserWindow } = require('electron');
const path = require('node:path');

const SITE_URL = 'https://kwatashop.example.com'; // Remplace par ta vraie URL de deploiement (Vercel/Netlify)

function creerFenetre() {
  const fenetre = new BrowserWindow({
    width: 1200,
    height: 800,
    icon: path.join(__dirname, 'build', 'icon.png'),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  fenetre.loadURL(SITE_URL);
  // Pour tester en local avant d'avoir un vrai hebergement, remplace la ligne
  // ci-dessus par :
  // fenetre.loadFile(path.join(__dirname, 'web', 'catalogue.html'));
}

app.whenReady().then(() => {
  creerFenetre();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) creerFenetre();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
