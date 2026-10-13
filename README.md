# PROJECT ONE · Assistant personnel IA

Application web installable sur iPhone et Android (PWA), sans App Store ni Google Play. L'assistant prépare, **vous validez**, puis l'action est exécutée et vérifiée.

---

## 1. En bref

| Sans rien configurer | Avec une clé Anthropic | Avec Supabase en plus |
|---|---|---|
| Toutes les pages, missions, calculs, agenda, mémoire, bilan, voix, notifications, installation sur téléphone, hors ligne | **Vraies réponses de l'IA** dans l'assistant | **Comptes**, sauvegarde en ligne, données sur tous les appareils, support relié, IA réservée aux comptes avec limite quotidienne |
| Assistant en « mode démo », signalé à l'écran | Limite de messages par adresse IP (approximative) | Limite de messages par compte (fiable) |

---

## 2. La technique, en clair

| Élément | Ce que c'est | Pourquoi |
|---|---|---|
| **React + TypeScript** | Le langage de l'interface | Standard, facile à reprendre par un développeur |
| **Vite** | L'outil qui lance et compile l'application | Rapide et gratuit |
| **PWA** (manifeste + service worker) | Ce qui rend le site installable | Icône sur l'écran d'accueil, plein écran, ouverture hors ligne |
| **Fonctions serveur** (`server/`, `api/`, `netlify/`) | Un petit serveur qui parle à l'IA | La clé API reste secrète, jamais dans le navigateur |
| **Claude (Anthropic)** | Le moteur d'IA | Réponses structurées : ce qui est sûr, hypothèses, étapes, questions |
| **Supabase** | Comptes + base de données | Chaque utilisateur ne voit que ses données (règles dans `supabase/schema.sql`) |
| **Vercel ou Netlify** | L'hébergement | Gratuit pour démarrer |

---

## 3. Lancer l'application sur votre ordinateur

**Prérequis :** [Node.js](https://nodejs.org) version 20 ou plus récente (bouton « LTS »).

Dans un terminal ouvert dans ce dossier :

```bash
npm install
npm run dev
```

Ouvrez `http://localhost:5173`. Pour tester sur votre téléphone : même Wi-Fi, puis ouvrez l'adresse « Network » affichée (par exemple `http://192.168.1.20:5173`).

Les réglages se font dans un fichier `.env` : copiez `.env.example`, renommez la copie en `.env`, remplissez, puis relancez `npm run dev`.

---

## 4. Activer la vraie IA (Anthropic)

1. Créez un compte sur [console.anthropic.com](https://console.anthropic.com), ajoutez un moyen de paiement et un peu de crédit.
2. **Fixez une limite de dépense mensuelle** dans la console (rubrique des limites de dépense) : c’est votre filet de sécurité.
3. Créez une clé (API Keys > Create Key) et copiez-la.
4. Dans `.env` (ou dans Vercel/Netlify, voir plus bas) : `ANTHROPIC_API_KEY=votre-clé`.

Le badge en haut de l'application passe de « Mode démo » à « IA connectée ».

- Modèle par défaut : `claude-opus-5-5` (le plus capable). Pour réduire les coûts et accélérer : `AI_MODEL=claude-sonnet-5-5` ou `AI_MODEL=claude-haiku-5-5`.
- `AI_DAILY_LIMIT=50` : nombre de messages IA par personne et par jour.

---

## 5. Activer les comptes et la sauvegarde en ligne (Supabase)

1. Créez un compte sur [supabase.com](https://supabase.com) puis **New project** (choisissez une région en Europe, par exemple Paris ou Francfort). Notez le mot de passe de la base.
2. Ouvrez **SQL Editor > New query**, collez tout le contenu de `supabase/schema.sql`, cliquez **Run**. Cela crée les tables, les règles d'accès (chacun ne voit que ses données), le compteur d'utilisation de l'IA et la suppression de compte.
3. Ouvrez **Project Settings > API** et copiez :
   - **Project URL** → `VITE_SUPABASE_URL`
   - la clé **anon public** → `VITE_SUPABASE_ANON_KEY` (elle est publique par conception ; ne copiez **jamais** la clé « service_role »).
4. Ouvrez **Authentication > URL Configuration** :
   - **Site URL** : l'adresse de votre site en ligne (par exemple `https://project-one.vercel.app`) ;
   - **Redirect URLs** : ajoutez la même adresse, et `http://localhost:5173` pour les tests.
5. (Conseillé) **Authentication > Emails** : personnalisez l'e-mail de confirmation en français.

Dès que ces deux variables sont présentes, la page **Compte** propose inscription, connexion et mot de passe oublié, et l'assistant IA devient réservé aux comptes connectés.

**Lire les demandes de support :** Supabase > Table Editor > `support_tickets`.

---

## 6. Mettre en ligne gratuitement

### Option A : Vercel (recommandée)

1. Mettez ce dossier dans un dépôt GitHub (je peux le faire pour vous si vous le souhaitez).
2. Sur [vercel.com](https://vercel.com) : **Add New > Project**, choisissez le dépôt. Vercel détecte tout seul la configuration (`vercel.json`).
3. **Settings > Environment Variables** : ajoutez `ANTHROPIC_API_KEY`, et si vous les utilisez `AI_MODEL`, `AI_DAILY_LIMIT`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_SUPPORT_EMAIL`.
4. **Deploy**. Après tout changement de variable : **Deployments > Redeploy**.

### Option B : Netlify

1. Sur [netlify.com](https://netlify.com) : **Add new site > Import an existing project**, choisissez le dépôt. La configuration est lue dans `netlify.toml`.
2. **Site configuration > Environment variables** : mêmes variables que ci-dessus.
3. Important : sur l'offre gratuite, Netlify coupe une réponse serveur au bout de 10 secondes. Ajoutez `AI_MODEL=claude-haiku-5-5` et `AI_TIMEOUT_MS=9000` pour rester sous cette limite.
4. **Deploy**.

Enfin, mettez l'adresse obtenue dans Supabase (étape 5.4).

**Sans Supabase**, n'importe qui ayant le lien peut utiliser l'IA jusqu'à la limite par adresse IP (approximative). Gardez alors le lien privé et gardez la limite de dépense Anthropic.

---

## 7. Installer l'application sur le téléphone

Une fois en ligne (adresse en `https://`) :

- **iPhone (Safari)** : bouton Partager, puis « Sur l'écran d'accueil », puis « Ajouter ».
- **Android (Chrome)** : bouton « Installer l'application » dans la page Compte ou Paramètres, ou menu ⋮ puis « Installer l'application ».

La page **Compte** (et Paramètres) affiche le bon mode d'emploi selon le téléphone. Une fois installée, l'application s'ouvre en plein écran, avec son icône, même hors ligne (l'assistant IA a besoin d'internet).

---

## 8. Ce qui fonctionne, ce qui demande une configuration

### Opérationnel tout de suite
- Les 13 écrans : accueil public, bienvenue, accueil, assistant, missions, détail de mission, bilan, mémoire, connexions, abonnement, paramètres, support, compte.
- Les 7 parcours de mission avec calculs réels : journée, comparaison d'offres, économies, démarche administrative (courrier), voyage, abonnements (avec dates d'échéance), rendez-vous.
- Les trois états d'une action (préparée, en attente de validation, exécutée et vérifiée) : rien ne s'exécute sans votre clic.
- Agenda, rappels, mémoire modifiable et effaçable, bilan avec graphiques, export de vos données, suppression complète.
- **Export de l'agenda vers votre calendrier** (fichier .ics pour Apple Calendrier, Google Agenda, Outlook), sans connecter de compte.
- **Notifications** : rappels et échéances, actions à valider, économies à confirmer, bilan du lundi. Elles respectent la plage « Ne pas déranger » et les sujets choisis.
- **Voix** : dictée (Chrome, Edge, Safari) et lecture des réponses, avec explications claires si le micro est refusé ou indisponible.
- **Hors ligne** : l'application s'ouvre et vos données restent accessibles ; l'assistant l'indique et répond au retour de la connexion (bouton « Réessayer »).
- Les données restent après actualisation ou redémarrage.

### Nécessite votre configuration
- **Vraies réponses de l'IA** : clé Anthropic (section 4). Sans elle, l'assistant reste en mode démo, toujours signalé.
- **Comptes, sauvegarde en ligne, support relié** : Supabase (section 5).
- **Support par e-mail pour les personnes sans compte** : `VITE_SUPPORT_EMAIL`.

### Pas encore disponible (indiqué honnêtement dans l'application)
- Paiement réel des formules Standard et Premium : la page Abonnement fonctionne en **mode test**, sans paiement. Il faudra Stripe, une société et des mentions légales.
- Connexions à Gmail, Google Agenda, banque, etc. : affichées « en préparation » (nécessitent des autorisations officielles OAuth).
- Notifications quand l'application est **fermée** : nécessitent un serveur de notifications (étape suivante).
- Marketplace : présentée comme une vision.

---

## 9. Coûts externes

| Service | Pour démarrer | Remarques |
|---|---|---|
| Vercel (Hobby) | 0 € | L'offre gratuite est réservée à un usage **non commercial** : pour vendre l'application, passez à l'offre Pro (payante) ou utilisez Netlify |
| Netlify (Free) | 0 € | Réponses serveur limitées à 10 s (voir 6.B) |
| Supabase (Free) | 0 € | Un projet gratuit inactif plusieurs jours est mis en pause (il se relance d'un clic) |
| Anthropic (IA) | Payé à l'usage | Coût par message variable selon le modèle et la longueur ; Haiku et Sonnet coûtent moins cher qu'Opus. Fixez une limite de dépense. Tarifs : [anthropic.com/pricing](https://www.anthropic.com/pricing) |
| Nom de domaine | Facultatif | Environ 10 à 20 € par an chez un registraire |

Les conditions des offres gratuites changent : vérifiez-les sur le site de chaque service avant le lancement.

---

## 10. Organisation des fichiers

```
api/              Fonctions serveur Vercel (/api/chat, /api/health)
netlify/          Fonction serveur Netlify (même logique)
server/           Logique serveur : IA, sécurité, limites (partagée)
supabase/         schema.sql : tables et règles d'accès à créer dans Supabase
pwa/              Modèle du service worker (hors ligne, notifications)
public/           Icônes (iPhone, Android), manifeste
src/pages/        Les écrans
src/components/   Éléments d'interface (boutons, graphiques, chat…)
src/lib/          Logique : missions, actions, IA, comptes, notifications, voix
src/styles/       Couleurs, polices (intégrées au projet), mise en page
.env.example      Modèle de configuration
```

| Commande | Effet |
|---|---|
| `npm run dev` | Lance l'application en développement |
| `npm run build` | Prépare la version en ligne (dossier `dist`) |
| `npm run preview` | Affiche la version en ligne en local |
| `npm run build:demo` | Démo en un seul fichier (`dist-demo/index.html`) |
| `npm run typecheck` | Vérifie le code |

---

## 11. Vérifications effectuées

- Vérification TypeScript et compilation de production : sans erreur.
- Clic automatique sur **chaque bouton et lien** de chaque écran : aucun bouton sans effet.
- Parcours complet automatisé sur téléphone (390 × 844) et ordinateur (1440 × 900), thèmes sombre et clair : aucune erreur, aucun débordement.
- Assistant IA testé de bout en bout avec un **faux fournisseur d'IA** reproduisant les réponses de l'API : réponse affichée et conservée après actualisation ; clé refusée, crédit épuisé, surcharge, erreur serveur, refus de répondre et IA qui ne répond pas (délai dépassé) donnent chacun un message clair ; « Réessayer » fonctionne sans doublon.
- Hors ligne : message clair, bandeau, reprise automatique au retour de la connexion ; l'application installée s'ouvre sans réseau (polices comprises).
- Voix : dictée réussie, micro refusé, rien entendu, navigateur non compatible.
- Sécurité de `/api/chat` : appel depuis un autre site refusé ; sans connexion, avec une session invalide et au-delà de la limite quotidienne : refusé avec le bon message (avec un faux Supabase).
- Fonctions Vercel et Netlify compilées et appelées en local.
- Échéance d'abonnement → rappel → export .ics ; demande de support.

**Non testé à ce stade** (impossible sans vos comptes) : un appel avec une vraie clé Anthropic, un vrai projet Supabase (inscription, e-mails, synchronisation entre deux appareils), un déploiement réel sur Vercel ou Netlify, et l'installation sur un vrai iPhone ou Android.
