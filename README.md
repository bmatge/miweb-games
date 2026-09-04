# miweb-games

Petits jeux web autonomes, sans dépendance ni build : une page, du canvas, rien d'autre.

En ligne : <https://miweb-games.lab.miweb.run>

## Contenu

| Jeu | Fichier | Pitch |
|---|---|---|
| Casse-brique du chef de projet | `index.html` | Vous êtes la barre, le projet est la balle. Référentiels, incidents et instances à faire tomber en trois COPIL. |

## Développer

Aucune chaîne de build. Ouvrir `index.html` dans un navigateur suffit.

```bash
python3 -m http.server 8000   # puis http://localhost:8000
```

## Déploiement

Déployé par [`spawn`](https://github.com/bmatge/vibelab-platform) sur la plateforme VibeLab,
en prototype (domaine wildcard, TTL 30 jours) :

```bash
ssh vps "spawn up miweb-games git@github.com:bmatge/miweb-games.git"
```

L'image est un `nginx:alpine` qui sert la page en statique. Le `compose.yml` respecte le
contrat spawn : pas de `ports:`, réseau externe `proxy`, labels Traefik paramétrés par
`${APP_NAME}` / `${DOMAIN}`.

## Ajouter un jeu

Tant qu'il n'y en a qu'un, il est servi à la racine. Au deuxième, déplacer chaque jeu dans
son dossier (`casse-brique/index.html`, etc.) et faire de la racine une page d'index —
`nginx.conf` sert déjà `try_files`, seul le `COPY` du `Dockerfile` sera à élargir.
