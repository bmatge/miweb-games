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
index.html          page d'accueil : une card par jeu, mise en page claire autonome
assets/arcade.css   coquille des jeux (salle d'arcade sombre : en-tête, HUD, scène, overlay)
assets/arcade.js    plein écran, inclinaison, cadrage et sprites pixel (Arcade.pix)
casse-brique/       jeu 1
snake/              jeu 2
```

Chaque jeu reste autonome : son moteur vit dans son `index.html`. Sont mutualisés la coquille
visuelle, les sprites, et trois comportements transverses (plein écran, inclinaison, cadrage).
L'accueil ne charge pas `arcade.css` : il garde une mise en page claire et institutionnelle,
et n'emprunte à `arcade.js` que les sprites pour ses vignettes.

## Direction artistique

Les jeux sont en **pixel art dessiné au canvas** : aucune image, aucune police externe, tout
passe par `fillRect`. `Arcade.pix` expose les primitives partagées :

- `grille(ctx, lignes, x, y, taille, palette)` — un sprite décrit en tableau de chaînes, une
  lettre par couleur, `.` transparent. Les pixels contigus d'une même couleur sont fusionnés en
  un seul rectangle, et chaque rectangle déborde d'une fraction sur son voisin : aux échelles
  non entières, le fond transparaissait sinon en fines coutures.
- `biseau(ctx, x, y, w, h, u, fond, creux)` — boîte à relief arcade, clair en haut/gauche,
  sombre en bas/droite (`creux` inverse, pour les socles).
- `picto(ctx, cle, …)` — six pictogrammes de famille en grille de **8×8** (tech, design,
  produit, contenu, qualité, data) plus la dette technique.
- `tete(ctx, x, y, taille, dir, langue)` — tête du serpent 8×8, tournée selon le cap.
- `agent(ctx, …)` (14×14, chemise paramétrable) et `balle(ctx, cx, cy, r)` (8×8).

La grille de 8 pour les cases n'est pas un choix esthétique mais de lisibilité : une case du
snake fait 26 px sur le canvas logique, 12 à 18 px sur un téléphone. À cette taille, un sprite
de 16 devient une tache. `imageSmoothingEnabled` ne joue pas ici, il ne concerne que
`drawImage`.

Le fond bleu `#000091` et les couleurs de familles sont conservés : c'est l'identité des
plateaux. La coquille autour, elle, ne suit plus le DSFR — palette sombre, monospace système
pour les compteurs et titres. Seul l'accueil reste dans le registre institutionnel.

## Ligne de flottaison

Le plateau et la ligne de journal doivent tenir dans la hauteur de la fenêtre, sur desktop
comme en paysage sur mobile. La largeur de la scène est bornée par la hauteur disponible :

```css
.scene{ width:min(100%, calc((100dvh - var(--chrome)) * var(--ratio))) }
```

`--ratio` est posé par chaque page (largeur / hauteur de son canvas). `--chrome` est mesuré
par `Arcade.cadrer(scene, journal)` à chaque `resize` : hauteur de tout ce qui précède la
scène, plus celle du journal. Une constante CSS ne suffisait pas, l'en-tête se replie sur deux
lignes selon la largeur. En paysage sur mobile (`max-height:520px`), les compteurs de l'en-tête
disparaissent — le bandeau du canvas les porte déjà — pour rendre chaque pixel au plateau.

### Plein écran

`Arcade.plein(el, bouton, onChange)` tente l'API native, et retombe sur une classe CSS
`position:fixed; inset:0` quand elle est indisponible — Safari iOS ne l'expose que sur les
éléments `<video>`. Les deux jeux recalculent alors leur canvas pour tenir dans **les deux**
dimensions : en paysage sur mobile, c'est la hauteur qui contraint.

La classe `.plein` est posée dans les **deux** modes, natif compris : elle porte la mise en
page plein écran *et* l'affichage de la barre de service. Cette barre (score, dernière phrase
du journal, bouton « Quitter ») est le seul moyen de sortir au doigt — il n'y a pas d'Échap
sur mobile, et le repli CSS n'ouvre pas la sortie native du navigateur.

L'appel renvoie `{basculer, actif, stat, message}` : chaque jeu alimente `stat()` et
`message()` depuis ses propres fonctions de mise à jour.

### Inclinaison

`Arcade.inclinaison(bouton, onTilt)` normalise `gamma`/`beta` selon l'orientation de l'écran.
iOS 13+ exige `DeviceOrientationEvent.requestPermission()` déclenché par un geste utilisateur,
d'où le bouton. Sur les appareils sans capteur, le bouton reste masqué : il n'apparaît qu'après
réception d'un événement porteur de valeurs.

Le callback reçoit `{gamma, beta, dGamma, dBeta}`. Les deux derniers sont **relatifs à la
position de départ**, capturée à l'activation : un téléphone tenu en main repose autour de
`beta = 40` à `70°`, jamais 0. Comparer les valeurs brutes faisait gagner l'axe vertical en
permanence et rendait le snake indirigeable.

- **Casse-brique** : `gamma` brut, l'angle donnant une position absolue de la barre — pas une
  vitesse. L'axe horizontal repose naturellement autour de 0, l'étalonnage n'y sert à rien.
- **Snake** : `dGamma`/`dBeta`, axe dominant seul, zone neutre de 12°.

## Tactile

Le cap du snake est décidé **pendant le `touchmove`**, dès que le glissement dépasse 22 px, et
non à la levée du doigt. Sur un mobile réel, un glissement vertical parti du plateau peut être
capté par le défilement de la page : le navigateur annule alors la séquence et émet
`touchcancel`, jamais `touchend`. Attendre la levée revenait à ne jamais tourner — alors que
le casse-brique, qui suit le doigt en continu, n'a jamais eu le problème. `touch-action: none`
est posé sur `.board` en plus du canvas, pour que le navigateur ne prenne jamais la main.

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
