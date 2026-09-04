# miweb games

Petits jeux web sur les coulisses d'un projet numérique. Une page par jeu, aucune dépendance,
aucun build, aucun pistage.

En ligne : <https://miweb-games.lab.miweb.run>

## Les jeux

| Jeu | Dossier | Pitch |
|---|---|---|
| Casse-brique du chef de projet | `casse-brique/` | Vous êtes la barre, le projet est la balle. Référentiels, incidents et instances à faire tomber en trois COPIL. |
| Snake — Constituez votre équipe web | `snake/` | Vous démarrez seul. Quarante métiers du web à recruter ; chaque profil allonge l'équipe et la rend plus dure à diriger. |
| La chaîne de validation | `validation/` | Un dossier à pousser du cadrage à la mise en ligne, à travers six instances dont les obstacles circulent. Percuté, il repart du départ ; la fin de gestion, elle, n'attend pas. |
| Le support N1 | `support/` | Douze guichets, les tickets sortent la tête. Taper avant la remontée en N2, sauf la demande du cabinet, qu'on escalade. |

## Structure

```
index.html          page d'accueil : une card par jeu, mise en page claire autonome
assets/arcade.css   coquille des jeux (salle d'arcade sombre : en-tête, HUD, scène, overlay)
assets/arcade.js    plein écran, inclinaison, cadrage et sprites pixel (Arcade.pix)
casse-brique/       jeu 1
snake/              jeu 2
validation/         jeu 3 (canvas 800×490, plus proche du 16/9)
support/            jeu 4 (idem)
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

- `texte(ctx, txt, x, y, u, couleur, align)` — police pixel 5×7 maison (majuscules, chiffres,
  ponctuation, accents sur une rangée au-dessus). `texteAjuste` réduit `u` pour tenir dans une
  largeur : c'est ce qui écrit les étiquettes de briques, les bandeaux et les bulles.
- `damier`, `cadre`, `lueur` — le plateau : fond à deux tons, cadre enfoncé, halo radial (le
  seul rendu non pixel, réservé à la balle, à la tête du serpent et aux cibles).

La grille de 8 pour les cases n'est pas un choix esthétique mais de lisibilité : une case du
snake fait 26 px sur le canvas logique, 12 à 18 px sur un téléphone. À cette taille, un sprite
de 16 devient une tache. `imageSmoothingEnabled` ne joue pas ici, il ne concerne que
`drawImage`.

Les impacts sont soulignés par deux effets purement visuels, tenus hors des règles : un
**flash** blanc qui s'étend puis s'éteint (brique cassée, profil recruté) et une **secousse**
du plateau (`ctx.translate` aléatoire décroissant : casse, socle heurté, balle perdue, fin de
partie). Le fond est peint plus large que le canvas pour que la secousse ne découvre pas de bord.

Le fond bleu `#000091` et les couleurs de familles sont conservés : c'est l'identité des
plateaux. La coquille autour, elle, ne suit plus le DSFR — palette sombre, monospace système
pour les compteurs. Seul l'accueil reste dans le registre institutionnel.

## Ligne de flottaison et deux mises en page

Le plateau doit tenir dans la hauteur de la fenêtre, sur desktop comme en paysage sur mobile.
Les canvas sont en 4/3 et les écrans en 16/9 : deux modes, choisis par le CSS (`--mode` sur
`.jeu`) et lus par `Arcade.cadrer()`, qui pose la largeur de la scène en JS à chaque `resize`.

- **`lateral`** (`min-width:760px` et `min-aspect-ratio:4/3`) : le plateau prend la hauteur à
  gauche ; la colonne de droite (`clamp(240px, 26vw, 320px)`) porte titre, compteurs, outils,
  journal avec ses quatre dernières phrases, puis la notice. C'est le mode desktop et paysage
  mobile.
- **`pile`** (portrait, écrans étroits) : en-tête au-dessus, plateau, journal d'une ligne,
  notice sous la ligne de flottaison. La largeur est bornée par la hauteur restante fois le
  ratio du canvas.

La mesure est en JS et non en CSS parce que l'en-tête se replie selon la largeur et que la
colonne est en `clamp()` : une constante ne suivait pas. Le journal est géré par
`Arcade.journal(el)`, qui garde l'historique dans un `.anciens` masqué en mode `pile`.

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
