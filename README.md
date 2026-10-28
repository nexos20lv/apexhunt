# 🎯 ApexHunt — Jeu de Manhunt IRL pour Smartphones

**ApexHunt** est une application Web mobile temps réel (PWA) conçue pour organiser des parties de **Manhunt dans la vraie vie (IRL)** entre amis avec leurs téléphones mobiles.

---

## ⚡ Fonctionnalités Clés

1. **Zéro Friction (Rejoindre en 3 secondes)** :
   - L'hôte génère une room avec un **code à 4 lettres** (ex: `WOLF`) ou un **QR Code géant**.
   - Les amis scannent le QR Code avec l'appareil photo de leur téléphone pour rejoindre immédiatement la partie.
   - Pas de compte, pas de mot de passe, pas de téléchargement sur l'App Store / Play Store.

2. **Mode Joueurs Illimité & Rôles Asymétriques** :
   - **Aucune limite de joueurs** : Jouez à 5, 10, 20, 50 potes ou plus dans la même partie !
   - **Multi-Fuyards simultanés** : Chaque fuyard a son **propre code secret à 4 chiffres unique** (ex: Lucas a `7419`, Thomas a `3820`).
   - **Mode Contagion / Infection IRL** : Dès qu'un fuyard est capturé (son code est entré par un chasseur), il est **infecté et devient immédiatement Chasseur** pour traquer ses anciens alliés ! Zéro ennui sur la touche : tout le monde joue sans interruption.
   - **Écran Chasseurs** : Compteur de fuyards restants en direct et affichage des impulsions sonar de tous les fuyards encore en liberté.
   - **Écran Fuyards** : Coopération tactique avec visibilité mutuelle entre fuyards sur la carte sombre.

3. **Radar Sonar Périodique (Anti-Camping & Anti-Cheat)** :
   - Le fuyard **n'est pas** traqué en continu (ce qui ruinerait le jeu en 2 minutes).
   - Toutes les 60 à 90 secondes, une impulsion sonar retentit (bip audio Web Audio procédural + vibration haptique).
   - Un **cercle d'incertitude rougeoyant de 40 à 60m** apparaît sur la carte des chasseurs (*« Fuyard repéré dans cette zone il y a 20s »*), préservant le bluff urbain et les feintes.

4. **Validation de Capture Anti-Litige par Code Secret** :
   - Le fuyard dispose d'un **code secret à 4 chiffres** affiché en haut de son écran (ex: `7 4 1 9`).
   - Pour éliminer le fuyard, les chasseurs doivent le rattraper physiquement, lire ce code et le taper sur leur pavé numérique tactile.

5. **Zone de Jeu Circulaire Rétrécissable (Geofencing)** :
   - Rayon ajustable (500m, 1km, 1.5km, 2km).
   - Si un joueur sort de la zone, une alarme retentit et sa position exacte est révélée en direct jusqu'à son retour dans la zone.

6. **Atouts Tactiques** :
   - *Ghost Mode* : Masque le prochain ping sonar.
   - *Faux Leurre* : Émet un faux ping radar à 200m pour feinter les chasseurs.

7. **Optimisation Mobile & Batterie (Apple HIG)** :
   - Thème **Dark OLED Pur (#000000)** : Éteint les pixels OLED des smartphones pour préserver l'autonomie et limiter la surchauffe.
   - **Screen WakeLock API** : Empêche le téléphone de se mettre en veille pendant la course.
   - Cartographie **Leaflet + CartoDB Dark Matter** ultra-légère (~40 Ko) à 60 fps sans GPU lourd.

---

## 🚀 Démarrage Rapide

### 1. Installation des dépendances
```bash
npm install
```

### 2. Lancer en local (Développement)
Pour lancer à la fois le serveur Fastify WebSockets (port 4000) et le client Vite (port 5173) :
```bash
# Dans le terminal 1 : Serveur
npm run dev:server

# Dans le terminal 2 : Client Web
npm run dev:client
```
Ouvrez `http://localhost:5173` sur votre navigateur.

---

## 📱 Comment Jouer Dehors avec vos Potes (Sur Réseau Mobile 4G/5G)

Sur smartphone, l'API Geolocation requiert impérativement une connexion sécurisée **HTTPS**. Pour jouer en extérieur dans les rues ou dans un parc avec vos amis :

### Option A : Tunnel Cloudflare gratuit (Recommandé)
Téléchargez `cloudflared` ou lancez :
```bash
npx cloudflared tunnel --url http://localhost:5173
```
Vous obtiendrez un lien HTTPS public (ex: `https://mon-manhunt.trycloudflare.com`) que tous vos potes peuvent ouvrir immédiatement sur leur téléphone en 4G/5G !

### Option B : Tunnel Localtunnel gratuit
```bash
npx localtunnel --port 5173
```

---

## 🧪 Tests Automatisés

Pour lancer la suite de tests unitaires (Haversine, géolocalisation, pings, machine d'état des rooms, règles de capture) :
```bash
npm test
```
