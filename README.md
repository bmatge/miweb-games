# miweb games

Petits jeux web sur les coulisses d'un projet numérique. Une page par jeu, aucune dépendance,
aucun build, aucun pistage.

En ligne : <https://miweb-games.lab.miweb.run>

## Les jeux

| Jeu | Dossier | Pitch |
|---|---|---|
| Casse-brique du chef de projet | `casse-brique/` | Vous êtes la barre, le projet est la balle. Référentiels, incidents et instances à faire tomber en trois COPIL. |
| Snake — Constituez votre équipe web | `snake/` | Vous démarrez seul. Quarante métiers du web à recruter ; chaque profil allonge l'équipe et la rend plus dure à diriger. |

## Structure

```
index.html          page d'accueil : une card par jeu
assets/arcade.css   coquille commune (HUD, plateau, overlay, plein écran)
assets/arcade.js    plein écran et pilotage à l'inclinaison
casse-brique/       jeu 1
snake/              jeu 2
```

Chaque jeu reste autonome : son moteur vit dans son `index.html`. Seuls la coquille visuelle
et les deux comportements transverses (plein écran, inclinaison) sont mutualisés.

### Plein écran

`Arcade.plein(el, bouton, onChange)` tente l'API native, et retombe sur une classe CSS
`position:fixed; inset:0` quand elle est indisponible — Safari iOS ne l'expose que sur les
éléments `<video>`. Les deux jeux recalculent alors leur canvas pour tenir dans **les deux**
dimensions : en paysage sur mobile, c'est la hauteur qui contraint.

### Inclinaison

`Arcade.inclinaison(bouton, onTilt)` normalise `gamma`/`beta` selon l'orientation de l'écran.
iOS 13+ exige `DeviceOrientationEvent.requestPermission()` déclenché par un geste utilisateur,
d'où le bouton. Sur les appareils sans capteur, le bouton reste masqué : il n'apparaît qu'après
réception d'un événement porteur de valeurs.

- **Casse-brique** : l'angle donne une position absolue de la barre, pas une vitesse.
- **Snake** : seul l'axe dominant est pris en compte, avec un seuil de 14°, pour éviter les
  changements de cap parasites quand l'appareil est tenu à la main.

## Développer

Aucune chaîne de build, mais un serveur est nécessaire (les jeux chargent `../assets/`) :

```bash
python3 -m http.server 8000   # puis http://localhost:8000
```

## Ajouter un jeu

1. Un dossier `<nom>/index.html`, qui charge `../assets/arcade.css` et `../assets/arcade.js`.
2. Une card dans `index.html`.
3. Rien à toucher côté Docker : l'image copie le dépôt tel quel.

## Déploiement

Déployé par [`spawn`](https://github.com/bmatge/vibelab-platform) sur la plateforme VibeLab,
en prototype (domaine wildcard, TTL 30 jours) :

```bash
ssh vps "spawn up miweb-games git@github.com:bmatge/miweb-games.git"
```

Image `nginx:alpine`. Le `compose.yml` respecte le contrat spawn : pas de `ports:`, réseau
externe `proxy`, labels Traefik paramétrés par `${APP_NAME}` / `${DOMAIN}`.
