/**
 * Socle commun aux jeux de miweb-games : plein ecran, inclinaison, cadrage et
 * sprites pixel (Arcade.pix).
 * Aucune dependance, expose un seul global `Arcade`.
 */
(function (global) {
  "use strict";

  /* ------------------------------------------------------------------ */
  /* Plein ecran                                                         */
  /* ------------------------------------------------------------------ */

  /**
   * Bascule le plein ecran sur `el`.
   *
   * L'API native est tentee en premier. Safari iOS ne l'expose que sur les
   * elements <video> : on retombe alors sur une classe CSS qui fixe le plateau
   * en position:fixed inset:0, ce qui donne le meme resultat visuel a la barre
   * d'adresse pres. Le repli sert aussi de secours si la promesse est rejetee
   * (permission refusee, iframe sans allowfullscreen).
   */
  function plein(el, bouton, onChange) {
    var natif = !!(el.requestFullscreen || el.webkitRequestFullscreen);

    // Barre de service, visible seulement en plein ecran. Elle porte la sortie :
    // sur mobile il n'y a pas d'Echap, et le repli CSS n'ouvre pas la sortie
    // native du navigateur — sans ce bouton on reste enferme dans le jeu.
    var barre = document.createElement("div");
    barre.className = "barre-plein";
    var bStat = document.createElement("span");
    bStat.className = "bp-stat";
    var bMsg = document.createElement("span");
    bMsg.className = "bp-msg";
    var bSortie = document.createElement("button");
    bSortie.className = "bp-sortie";
    bSortie.type = "button";
    bSortie.textContent = "Quitter";
    barre.appendChild(bStat);
    barre.appendChild(bMsg);
    barre.appendChild(bSortie);
    el.appendChild(barre);
    bSortie.addEventListener("click", function (e) {
      e.stopPropagation();
      basculer();
    });

    // `.plein` est posee dans les DEUX modes, natif comme repli. Elle porte la
    // mise en page plein ecran (centrage, letterbox) ET l'affichage de la
    // barre : sans elle en mode natif, il n'y avait aucun bouton de sortie.
    var modeNatif = false;

    function actif() {
      return el.classList.contains("plein");
    }

    function poser(on) {
      el.classList.toggle("plein", on);
      document.body.classList.toggle("plein-actif", on);
      // La barre est en position absolue : sans reservation, elle recouvrirait
      // le haut du plateau en paysage, quand le canvas occupe toute la hauteur.
      // On mesure apres la pose de la classe (display:none donne 0).
      el.style.paddingTop = on ? barre.offsetHeight + "px" : "";
      majBouton();
      if (onChange) onChange(on);
    }

    function majBouton() {
      if (!bouton) return;
      var on = actif();
      bouton.textContent = on ? "Quitter le plein écran" : "Plein écran";
      bouton.setAttribute("aria-pressed", String(on));
    }

    function basculer() {
      if (actif()) {
        if (modeNatif) {
          if (document.exitFullscreen) document.exitFullscreen();
          else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
          else { modeNatif = false; poser(false); }
        } else {
          poser(false);
        }
        return;
      }
      if (natif) {
        var p = (el.requestFullscreen || el.webkitRequestFullscreen).call(el);
        // La classe est posee par l'evenement fullscreenchange en cas de
        // succes ; en cas de refus on bascule sur le repli CSS.
        if (p && p.catch) p.catch(function () { modeNatif = false; poser(true); });
        return;
      }
      poser(true);
    }

    function surChangement() {
      var elNatif = document.fullscreenElement || document.webkitFullscreenElement;
      if (elNatif === el) {
        modeNatif = true;
        poser(true);
      } else if (modeNatif) {
        // Sortie native (bouton, Echap, geste du navigateur) : nettoyer.
        modeNatif = false;
        poser(false);
      }
    }

    document.addEventListener("fullscreenchange", surChangement);
    document.addEventListener("webkitfullscreenchange", surChangement);
    if (bouton) bouton.addEventListener("click", basculer);
    majBouton();

    return {
      basculer: basculer,
      actif: actif,
      stat: function (t) { bStat.textContent = t; },
      message: function (t) { bMsg.textContent = t; },
      /** Hauteur occupee par la barre, a retrancher de la place disponible. */
      hauteur: function () { return actif() ? barre.offsetHeight : 0; }
    };
  }

  /* ------------------------------------------------------------------ */
  /* Inclinaison (accelerometre)                                         */
  /* ------------------------------------------------------------------ */

  /**
   * Active le pilotage a l'inclinaison.
   *
   * `onTilt` recoit `{gamma, beta, dGamma, dBeta}` en degres, deja corriges de
   * l'orientation de l'ecran : gamma > 0 = appareil penche vers la droite,
   * beta > 0 = penche vers l'avant.
   *
   * `dGamma`/`dBeta` sont relatifs a la position de depart, capturee a
   * l'activation. C'est ce qu'il faut des que les deux axes comptent : un
   * telephone tenu en main repose autour de beta = 40 a 70 degres, jamais 0.
   * Comparer les valeurs brutes ferait gagner l'axe vertical en permanence.
   *
   * iOS 13+ exige une demande de permission declenchee par un geste
   * utilisateur — d'ou le bouton. Ailleurs, l'ecoute demarre directement. Le
   * bouton est masque si l'appareil n'a pas de capteur (poste fixe).
   */
  function inclinaison(bouton, onTilt) {
    var supporte = typeof global.DeviceOrientationEvent !== "undefined";
    var besoinPermission = supporte &&
      typeof global.DeviceOrientationEvent.requestPermission === "function";
    // Un poste fixe expose DeviceOrientationEvent sans jamais l'emettre : on
    // n'affiche le bouton que si un evenement porteur de valeurs arrive, ou si
    // une permission est explicitement requise (donc mobile).
    var actif = false, vu = false, refG = null, refB = null;

    if (!supporte || !bouton) {
      if (bouton) bouton.hidden = true;
      return { actif: function () { return false; } };
    }

    function surOrientation(e) {
      if (e.gamma === null && e.beta === null) return;
      if (!vu) {
        vu = true;
        bouton.hidden = false;
      }
      if (!actif) return;

      var g = e.gamma || 0, b = e.beta || 0;
      var angle = 0;
      if (typeof global.screen !== "undefined" && global.screen.orientation &&
          typeof global.screen.orientation.angle === "number") {
        angle = global.screen.orientation.angle;
      } else if (typeof global.orientation === "number") {
        angle = global.orientation;
      }
      // Rotation du repere capteur vers le repere ecran.
      var gg = g, bb = b;
      if (angle === 90) { gg = b; bb = -g; }
      else if (angle === 180) { gg = -g; bb = -b; }
      else if (angle === 270 || angle === -90) { gg = -b; bb = g; }

      // Premiere mesure apres activation : elle devient le neutre.
      if (refG === null) { refG = gg; refB = bb; }

      onTilt({ gamma: gg, beta: bb, dGamma: gg - refG, dBeta: bb - refB });
    }

    function majBouton() {
      bouton.textContent = "Inclinaison : " + (actif ? "activée" : "désactivée");
      bouton.setAttribute("aria-pressed", String(actif));
    }

    function demarrer() {
      global.addEventListener("deviceorientation", surOrientation);
      refG = refB = null;   // re-etalonnage a chaque activation
      actif = true;
      majBouton();
    }

    bouton.hidden = !besoinPermission;
    majBouton();

    bouton.addEventListener("click", function () {
      if (actif) {
        global.removeEventListener("deviceorientation", surOrientation);
        actif = false;
        refG = refB = null;
        majBouton();
        return;
      }
      if (besoinPermission) {
        global.DeviceOrientationEvent.requestPermission().then(function (r) {
          if (r === "granted") demarrer();
          else {
            bouton.textContent = "Inclinaison refusée";
            bouton.disabled = true;
          }
        }).catch(function () {
          bouton.textContent = "Inclinaison indisponible";
          bouton.disabled = true;
        });
        return;
      }
      demarrer();
    });

    // Hors iOS : on ecoute tout de suite pour detecter la presence d'un capteur,
    // sans agir tant que l'utilisateur n'a pas active le mode.
    if (!besoinPermission) global.addEventListener("deviceorientation", surOrientation);

    return { actif: function () { return actif; } };
  }

  /* ------------------------------------------------------------------ */
  /* Cadrage : le plateau tient au-dessus de la ligne de flottaison       */
  /* ------------------------------------------------------------------ */

  /**
   * Dimensionne la scene pour que le plateau tienne dans la fenetre, au-dessus
   * de la ligne de flottaison. Deux modes, choisis par le CSS via `--mode` :
   *
   * - `pile` (portrait, ecrans etroits) : en-tete au-dessus, journal dessous.
   *   La largeur est bornee par la hauteur restante fois le ratio du canvas.
   * - `lateral` (ecrans larges, 16/9) : la colonne `.lateral` porte titre,
   *   compteurs et journal a cote du plateau, qui prend toute la hauteur.
   *
   * La mesure est faite en JS et non en CSS parce que l'en-tete se replie
   * selon la largeur et que la largeur de la colonne est en `clamp()` : une
   * constante ne pouvait pas suivre.
   */
  function cadrer(scene, journal) {
    var jeu = scene.parentElement;
    var cs = getComputedStyle(jeu);
    var lateral = cs.getPropertyValue("--mode").trim() === "lateral";
    var ratio = parseFloat(getComputedStyle(scene).getPropertyValue("--ratio")) || 800 / 560;
    var haut = 0, el = scene;
    while (el) { haut += el.offsetTop || 0; el = el.offsetParent; }
    // En mode lateral, le journal est a cote du plateau et ne prend pas de
    // hauteur ; la colonne laterale prend de la largeur.
    var bas = (!lateral && journal) ? journal.offsetHeight + 8 : 0;
    var dispoH = global.innerHeight - haut - bas - 12;
    var dispoW = jeu.clientWidth;
    if (lateral) {
      var aside = jeu.querySelector(".lateral");
      dispoW -= (aside ? aside.offsetWidth : 0) + (parseFloat(cs.columnGap) || 0);
    }
    var w = Math.max(200, Math.min(dispoW, dispoH * ratio));
    scene.style.width = w + "px";
  }

  /* ------------------------------------------------------------------ */
  /* Journal : derniere phrase en clair, les precedentes en retrait       */
  /* ------------------------------------------------------------------ */

  /**
   * `el` contient un <span> d'etiquette et un `.mot`. Les phrases precedentes
   * sont conservees dans un `.anciens` (quatre au plus), que la coquille
   * n'affiche qu'en mode lateral, ou il y a de la place pour une histoire.
   */
  function journal(el) {
    var mot = el.querySelector(".mot");
    var anciens = document.createElement("div");
    anciens.className = "anciens";
    el.appendChild(anciens);
    var dernier = mot ? mot.textContent : "";
    return {
      ecrire: function (txt) {
        if (txt === dernier) return;
        if (dernier) {
          var l = document.createElement("div");
          l.textContent = dernier;
          anciens.insertBefore(l, anciens.firstChild);
          while (anciens.children.length > 4) anciens.removeChild(anciens.lastChild);
        }
        dernier = txt;
        if (mot) mot.textContent = txt;
      },
      dernier: function () { return dernier; }
    };
  }

  /* ------------------------------------------------------------------ */
  /* Sprites pixel : primitives de dessin partagees par les jeux          */
  /* ------------------------------------------------------------------ */

  /**
   * Tout est dessine au canvas par `fillRect`, en grille de 8 (les cases du
   * snake) ou de 14 (les personnages). Aucune image, aucun `drawImage` :
   * `imageSmoothingEnabled` ne joue donc pas, et un sprite reste net a toute
   * echelle. Les pixels d'une meme ligne et d'une meme couleur sont fusionnes
   * en un seul rectangle, et chaque rectangle deborde d'une fraction sur son
   * voisin : sans cela, aux echelles non entieres, le fond transparait en
   * fines coutures entre les pixels.
   */
  var MONO = "ui-monospace, Menlo, Consolas, 'Liberation Mono', monospace";
  var SANS = "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

  function grille(ctx, lignes, x, y, taille, palette) {
    var n = lignes[0].length, u = taille / n, deb = .6;
    for (var r = 0; r < lignes.length; r++) {
      var l = lignes[r], c = 0;
      while (c < n) {
        var k = l[c];
        var col = palette[k];
        if (!col) { c++; continue; }
        var fin = c;
        while (fin + 1 < n && l[fin + 1] === k) fin++;
        ctx.fillStyle = col;
        ctx.fillRect(x + c * u, y + r * u, (fin - c + 1) * u + deb, u + deb);
        c = fin + 1;
      }
    }
  }

  /** Boite biseautee : clair en haut/gauche, sombre en bas/droite. `creux`
   *  inverse le relief (brique enfoncee, socle). */
  function biseau(ctx, x, y, w, h, u, fond, creux) {
    var clair = "rgba(255,255,255,.45)", sombre = "rgba(0,0,0,.35)";
    if (creux) { var t = clair; clair = sombre; sombre = t; }
    ctx.fillStyle = fond;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = clair;
    ctx.fillRect(x, y, w, u);
    ctx.fillRect(x, y, u, h);
    ctx.fillStyle = sombre;
    ctx.fillRect(x, y + h - u, w, u);
    ctx.fillRect(x + w - u, y, u, h);
  }

  /* Pictogrammes de famille, 8x8. Un par famille de metiers du snake, plus
     la dette technique. Le pixel 'X' prend la couleur passee a l'appel. */
  var PICTOS = {
    tech: [           // < >
      "........",
      "..X..X..",
      ".X....X.",
      "X......X",
      "X......X",
      ".X....X.",
      "..X..X..",
      "........"],
    design: [         // trait de pinceau
      "......XX",
      ".....XXX",
      "....XXX.",
      "...XXX..",
      "..XXX...",
      ".XXX....",
      "XX......",
      "X......."],
    produit: [        // le backlog
      "X.XXXXX.",
      "........",
      "X.XXXXX.",
      "........",
      "X.XXXXX.",
      "........",
      "X.XXXXX.",
      "........"],
    contenu: [        // bulle
      ".XXXXXX.",
      "X......X",
      "X......X",
      "X......X",
      ".XXXXXX.",
      "..X.....",
      ".X......",
      "........"],
    qualite: [        // coche
      ".......X",
      "......XX",
      ".....XX.",
      "X...XX..",
      "XX.XX...",
      ".XXX....",
      "..X.....",
      "........"],
    data: [           // barres
      "........",
      "......XX",
      "......XX",
      "...XX.XX",
      "...XX.XX",
      "XX.XX.XX",
      "XX.XX.XX",
      "XX.XX.XX"],
    dette: [          // croix
      "X......X",
      "XX....XX",
      ".XX..XX.",
      "..XXXX..",
      "..XXXX..",
      ".XX..XX.",
      "XX....XX",
      "X......X"]
  };

  function picto(ctx, cle, x, y, taille, couleur) {
    var g = PICTOS[cle];
    if (g) grille(ctx, g, x, y, taille, { X: couleur });
  }

  /* Tete du serpent, 8x8, dessinee vers la droite puis tournee selon le cap.
     Contour sombre : la famille « produit » est jaune elle aussi, sans lui la
     tete et un profil a recruter etaient indiscernables. */
  var TETE_DROITE = [
    ".NNNNNN.",
    "NJJJJJJN",
    "NJJJJNJN",
    "NJJJJJJN",
    "NJJJJJJN",
    "NJJJJNJN",
    "NJJJJJJN",
    ".NNNNNN."];
  function tourner(g) {         // quart de tour horaire
    var n = g.length, out = [];
    for (var r = 0; r < n; r++) {
      var l = "";
      for (var c = 0; c < n; c++) l += g[n - 1 - c][r];
      out.push(l);
    }
    return out;
  }
  var TETES = { "1,0": TETE_DROITE };
  TETES["0,1"] = tourner(TETE_DROITE);
  TETES["-1,0"] = tourner(TETES["0,1"]);
  TETES["0,-1"] = tourner(TETES["-1,0"]);
  var PAL_TETE = { N: "#161616", J: "#FFCA00" };

  /**
   * Tete en (x, y) de cote `taille`, orientee par `dir` ({x, y} unitaire).
   * `langue` (booleen) ajoute deux pixels rouges devant : a faire clignoter
   * par l'appelant.
   */
  function tete(ctx, x, y, taille, dir, langue) {
    var g = TETES[dir.x + "," + dir.y] || TETE_DROITE;
    grille(ctx, g, x, y, taille, PAL_TETE);
    if (langue) {
      var u = taille / 8;
      ctx.fillStyle = "#E1000F";
      // Un carre de 2x2 pixels centre sur l'axe du cap, juste au-dela du
      // contour : colonnes 8-9 vers la droite, -2/-1 vers la gauche.
      ctx.fillRect(x + (3 + dir.x * 5) * u, y + (3 + dir.y * 5) * u, 2 * u, 2 * u);
    }
  }

  /* Petit agent, 14x14 : cheveux N, peau P, chemise C, pieds N. */
  var AGENT = [
    ".....NNNN.....",
    "....NNNNNN....",
    "...NPPPPPPN...",
    "...NPNPPNPN...",
    "...NPPPPPPN...",
    "...NPPNNPPN...",
    "....NPPPPN....",
    ".....NPPN.....",
    "...CCCCCCCC...",
    "..CCCCCCCCCC..",
    "..CCCCCCCCCC..",
    "..CCCCCCCCCC..",
    "..CC.CC.CC.CC.",
    "..NN......NN.."];
  function agent(ctx, x, y, taille, chemise) {
    grille(ctx, AGENT, x, y, taille, {
      N: "#161616", P: "#f2b8a0", C: chemise || "#ffffff"
    });
  }

  /* Personnage vu de face, 8 de large sur 10 de haut : cheveux H, peau P,
     yeux N, chemise C, cravate T. Trois variantes selon le regard (gauche,
     face, droite), pour que la tete de file regarde ou elle va. */
  var PERSONNE = {
    face: [
      "..HHHH..",
      ".HHHHHH.",
      ".HPPPPH.",
      ".HPNPNH.",
      "..PPPP..",
      ".CCTTCC.",
      "CCCTTCCC",
      "CCCCCCCC",
      "CCCCCCCC",
      ".CC..CC."],
    gauche: [
      "..HHHH..",
      ".HHHHHH.",
      ".HPPPPH.",
      ".HNPNPH.",
      "..PPPP..",
      ".CCTTCC.",
      "CCCTTCCC",
      "CCCCCCCC",
      "CCCCCCCC",
      ".CC..CC."],
    droite: [
      "..HHHH..",
      ".HHHHHH.",
      ".HPPPPH.",
      ".HPNPNH.",
      "..PPPP..",
      ".CCTTCC.",
      "CCCTTCCC",
      "CCCCCCCC",
      "CCCCCCCC",
      ".CC..CC."]
  };
  // Les yeux : ecartes de face, decales d'un pixel selon le regard.
  PERSONNE.face[3] = ".HNPPNH.";
  PERSONNE.gauche[3] = ".HNPNPH.";
  PERSONNE.droite[3] = ".HPNPNH.";
  var CHEVEUX = ["#161616", "#4a2c14", "#c98b2a", "#a3341b", "#6b6b6b", "#2b2b6b"];
  var PEAUX = ["#f2b8a0", "#d99a6b", "#8d5a3b", "#f7d5b5"];

  /**
   * Personnage en (x, y), `taille` = largeur (la hauteur vaut 1,25 fois).
   * `look` : {chemise, cheveux, peau, cravate, regard} ; `regard` vaut
   * "gauche", "droite" ou rien. Sans cravate, les pixels T prennent la
   * couleur de la chemise.
   */
  function personne(ctx, x, y, taille, look) {
    look = look || {};
    var g = PERSONNE[look.regard] || PERSONNE.face;
    var chemise = look.chemise || "#ffffff";
    grille(ctx, g, x, y, taille, {
      H: look.cheveux || CHEVEUX[0],
      P: look.peau || PEAUX[0],
      N: "#161616",
      C: chemise,
      T: look.cravate || chemise
    });
  }
  /** Un look aleatoire stable : a tirer une fois par personne, puis a garder. */
  function lookAleatoire() {
    return {
      cheveux: CHEVEUX[Math.floor(Math.random() * CHEVEUX.length)],
      peau: PEAUX[Math.floor(Math.random() * PEAUX.length)]
    };
  }

  /* Balle, 8x8 : jaune, reflet en haut a gauche, ombre en bas a droite. */
  var BALLE = [
    "..JJJJ..",
    ".JBBJJJ.",
    "JBJJJJJJ",
    "JJJJJJJJ",
    "JJJJJJJJ",
    "JJJJJJSJ",
    ".JJJJSS.",
    "..JJJJ.."];
  var PAL_BALLE = { J: "#FFCA00", B: "#fff5c2", S: "#a37f00" };
  function balle(ctx, cx, cy, r) {
    grille(ctx, BALLE, cx - r, cy - r, 2 * r, PAL_BALLE);
  }

  /* ------------------------------------------------------------------ */
  /* Police pixel 5x7                                                    */
  /* ------------------------------------------------------------------ */

  /**
   * Majuscules, chiffres et la ponctuation dont les jeux ont besoin. Les
   * accents occupent une rangee au-dessus de la lettre (E accent aigu = E
   * plus la marque), la cedille une rangee en dessous. Les minuscules sont
   * remontees en majuscules : a cette taille, une police pixel n'a qu'une
   * casse.
   */
  var GLYPHES = {
    A: [".XXX.", "X...X", "X...X", "XXXXX", "X...X", "X...X", "X...X"],
    B: ["XXXX.", "X...X", "X...X", "XXXX.", "X...X", "X...X", "XXXX."],
    C: [".XXX.", "X...X", "X....", "X....", "X....", "X...X", ".XXX."],
    D: ["XXXX.", "X...X", "X...X", "X...X", "X...X", "X...X", "XXXX."],
    E: ["XXXXX", "X....", "X....", "XXXX.", "X....", "X....", "XXXXX"],
    F: ["XXXXX", "X....", "X....", "XXXX.", "X....", "X....", "X...."],
    G: [".XXX.", "X...X", "X....", "X.XXX", "X...X", "X...X", ".XXXX"],
    H: ["X...X", "X...X", "X...X", "XXXXX", "X...X", "X...X", "X...X"],
    I: ["XXXXX", "..X..", "..X..", "..X..", "..X..", "..X..", "XXXXX"],
    J: ["..XXX", "...X.", "...X.", "...X.", "...X.", "X..X.", ".XX.."],
    K: ["X...X", "X..X.", "X.X..", "XX...", "X.X..", "X..X.", "X...X"],
    L: ["X....", "X....", "X....", "X....", "X....", "X....", "XXXXX"],
    M: ["X...X", "XX.XX", "X.X.X", "X.X.X", "X...X", "X...X", "X...X"],
    N: ["X...X", "XX..X", "X.X.X", "X..XX", "X...X", "X...X", "X...X"],
    O: [".XXX.", "X...X", "X...X", "X...X", "X...X", "X...X", ".XXX."],
    P: ["XXXX.", "X...X", "X...X", "XXXX.", "X....", "X....", "X...."],
    Q: [".XXX.", "X...X", "X...X", "X...X", "X.X.X", "X..X.", ".XX.X"],
    R: ["XXXX.", "X...X", "X...X", "XXXX.", "X.X..", "X..X.", "X...X"],
    S: [".XXXX", "X....", "X....", ".XXX.", "....X", "....X", "XXXX."],
    T: ["XXXXX", "..X..", "..X..", "..X..", "..X..", "..X..", "..X.."],
    U: ["X...X", "X...X", "X...X", "X...X", "X...X", "X...X", ".XXX."],
    V: ["X...X", "X...X", "X...X", "X...X", "X...X", ".X.X.", "..X.."],
    W: ["X...X", "X...X", "X...X", "X.X.X", "X.X.X", "XX.XX", "X...X"],
    X: ["X...X", "X...X", ".X.X.", "..X..", ".X.X.", "X...X", "X...X"],
    Y: ["X...X", "X...X", ".X.X.", "..X..", "..X..", "..X..", "..X.."],
    Z: ["XXXXX", "....X", "...X.", "..X..", ".X...", "X....", "XXXXX"],
    "0": [".XXX.", "X...X", "X..XX", "X.X.X", "XX..X", "X...X", ".XXX."],
    "1": ["..X..", ".XX..", "..X..", "..X..", "..X..", "..X..", ".XXX."],
    "2": [".XXX.", "X...X", "....X", "...X.", "..X..", ".X...", "XXXXX"],
    "3": ["XXXXX", "...X.", "..X..", "...X.", "....X", "X...X", ".XXX."],
    "4": ["...X.", "..XX.", ".X.X.", "X..X.", "XXXXX", "...X.", "...X."],
    "5": ["XXXXX", "X....", "XXXX.", "....X", "....X", "X...X", ".XXX."],
    "6": ["..XX.", ".X...", "X....", "XXXX.", "X...X", "X...X", ".XXX."],
    "7": ["XXXXX", "....X", "...X.", "..X..", ".X...", ".X...", ".X..."],
    "8": [".XXX.", "X...X", "X...X", ".XXX.", "X...X", "X...X", ".XXX."],
    "9": [".XXX.", "X...X", "X...X", ".XXXX", "....X", "...X.", ".XX.."],
    ":": [".....", "..X..", "..X..", ".....", "..X..", "..X..", "....."],
    "/": ["....X", "....X", "...X.", "..X..", ".X...", "X....", "X...."],
    "-": [".....", ".....", ".....", "XXXXX", ".....", ".....", "....."],
    ".": [".....", ".....", ".....", ".....", ".....", ".XX..", ".XX.."],
    ",": [".....", ".....", ".....", ".....", "..XX.", "..X..", ".X..."],
    "!": ["..X..", "..X..", "..X..", "..X..", "..X..", ".....", "..X.."],
    "?": [".XXX.", "X...X", "....X", "...X.", "..X..", ".....", "..X.."],
    "'": ["..X..", "..X..", ".X...", ".....", ".....", ".....", "....."],
    "(": ["...X.", "..X..", ".X...", ".X...", ".X...", "..X..", "...X."],
    ")": [".X...", "..X..", "...X.", "...X.", "...X.", "..X..", ".X..."],
    "×": [".....", "X...X", ".X.X.", "..X..", ".X.X.", "X...X", "....."],
    "·": [".....", ".....", ".....", "..X..", ".....", ".....", "....."],
    "+": [".....", "..X..", "..X..", "XXXXX", "..X..", "..X..", "....."],
    "€": ["..XXX", ".X...", "XXXX.", ".X...", "XXXX.", ".X...", "..XXX"],
    "≡": [".....", "XXXXX", ".....", "XXXXX", ".....", "XXXXX", "....."],
    "%": ["XX..X", "XX.X.", "...X.", "..X..", ".X...", "X.XX.", "X..XX"],
    "<": ["...X.", "..X..", ".X...", "X....", ".X...", "..X..", "...X."],
    ">": [".X...", "..X..", "...X.", "....X", "...X.", "..X..", ".X..."]
  };
  GLYPHES["—"] = GLYPHES["–"] = GLYPHES["-"];
  var ACCENTS = {
    "É": ["E", "..XX."], "È": ["E", ".XX.."], "Ê": ["E", "..X.."], "Ë": ["E", ".X.X."],
    "À": ["A", ".XX.."], "Â": ["A", "..X.."], "Î": ["I", "..X.."], "Ï": ["I", ".X.X."],
    "Ô": ["O", "..X.."], "Ù": ["U", ".XX.."], "Û": ["U", "..X.."], "Ü": ["U", ".X.X."]
  };
  var CEDILLE = ["..X..", ".XX.."];

  function largeur(txt, u) {
    var w = 0;
    for (var i = 0; i < txt.length; i++) w += (txt[i] === " " ? 4 : 6) * u;
    return w - u;
  }

  /**
   * Ecrit `txt` en pixels de cote `u` (glyphe de 5u x 7u, chasse 6u).
   * `y` est le haut des lettres ; les accents sortent au-dessus, la cedille
   * en dessous. `align` : left (defaut) | center | right. Renvoie la largeur.
   */
  function texte(ctx, txt, x, y, u, couleur, align) {
    txt = String(txt).toUpperCase();
    var w = largeur(txt, u);
    if (align === "center") x -= w / 2;
    else if (align === "right") x -= w;
    var pal = { X: couleur };
    for (var i = 0; i < txt.length; i++) {
      var ch = txt[i];
      if (ch === " ") { x += 4 * u; continue; }
      var g = GLYPHES[ch], acc = ACCENTS[ch];
      if (acc) { g = GLYPHES[acc[0]]; grille(ctx, [acc[1]], x, y - 2 * u, 5 * u, pal); }
      else if (ch === "Ç") { g = GLYPHES.C; grille(ctx, CEDILLE, x, y + 7 * u, 5 * u, pal); }
      if (g) grille(ctx, g, x, y, 5 * u, pal);
      else { ctx.fillStyle = couleur; ctx.fillRect(x, y + 5 * u, 5 * u, 2 * u); }
      x += 6 * u;
    }
    return w;
  }

  /** Comme `texte`, mais `u` est reduit s'il le faut pour tenir dans `max`. */
  function texteAjuste(ctx, txt, x, y, max, uMax, couleur, align) {
    var u = Math.min(uMax, max / largeur(String(txt), 1));
    return texte(ctx, txt, x, y, u, couleur, align);
  }

  /* ------------------------------------------------------------------ */
  /* Plateau : damier, cadre, lueur                                      */
  /* ------------------------------------------------------------------ */

  /** Damier a deux tons : donne de la matiere au fond sans lignes. */
  function damier(ctx, x, y, w, h, taille, c1, c2) {
    ctx.fillStyle = c1;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = c2;
    var cols = Math.ceil(w / taille), rows = Math.ceil(h / taille);
    for (var r = 0; r < rows; r++) {
      for (var c = (r % 2); c < cols; c += 2) {
        var cw = Math.min(taille, x + w - (x + c * taille));
        var ch = Math.min(taille, y + h - (y + r * taille));
        ctx.fillRect(x + c * taille, y + r * taille, cw, ch);
      }
    }
  }

  /** Cadre enfonce autour de l'aire de jeu : sombre en haut/gauche, clair
   *  en bas/droite, avec un filet interieur. */
  function cadre(ctx, x, y, w, h, u) {
    ctx.fillStyle = "rgba(0,0,0,.45)";
    ctx.fillRect(x, y, w, u);
    ctx.fillRect(x, y, u, h);
    ctx.fillStyle = "rgba(255,255,255,.18)";
    ctx.fillRect(x, y + h - u, w, u);
    ctx.fillRect(x + w - u, y, u, h);
    ctx.fillStyle = "rgba(255,255,255,.06)";
    ctx.fillRect(x + u, y + u, w - 2 * u, 1);
    ctx.fillRect(x + u, y + u, 1, h - 2 * u);
  }

  function rgb(hex) {
    var n = parseInt(hex.slice(1), 16);
    return (n >> 16) + "," + ((n >> 8) & 255) + "," + (n & 255);
  }

  /** Lueur radiale : le seul endroit ou le rendu n'est pas en pixels.
   *  `alpha` au centre, transparent a `r`. */
  function lueur(ctx, cx, cy, r, hex, alpha) {
    var c = rgb(hex);
    var g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, "rgba(" + c + "," + (alpha == null ? .35 : alpha) + ")");
    g.addColorStop(1, "rgba(" + c + ",0)");
    ctx.fillStyle = g;
    ctx.fillRect(cx - r, cy - r, 2 * r, 2 * r);
  }


  /* ------------------------------------------------------------------ */
  /* Tableau des scores : local au navigateur, pseudo persistant          */
  /* ------------------------------------------------------------------ */

  var JEUX = [
    { cle: "casse-brique", nom: "Casse-brique du chef de projet", unite: "jours-homme" },
    { cle: "snake",        nom: "Snake, constituez votre équipe web", unite: "profils" },
    { cle: "validation",   nom: "La chaîne de validation", unite: "dossiers en ligne" },
    { cle: "support",      nom: "Le support N1 du site", unite: "points" }
  ];
  var CLE_PSEUDO = "miweb-games:pseudo", PSEUDO_MAX = 14;
  // Apres l'inscription, la touche Entree qui a valide le formulaire ne doit
  // pas relancer la partie dans la foulee : les jeux consultent ce verrou.
  var verrouJusqua = 0;
  function verrou() { return Date.now() < verrouJusqua; }

  /** Pseudo du joueur, conserve dans ce navigateur et modifiable partout ou
   *  il est demande (fin de partie, accueil). */
  function pseudo(nouveau) {
    if (nouveau !== undefined) {
      var p = String(nouveau).trim().replace(/\s+/g, " ").slice(0, PSEUDO_MAX);
      ecrireJSON(CLE_PSEUDO, p);
      return p;
    }
    return lireJSON(CLE_PSEUDO, "") || "";
  }

  function lireJSON(cle, defaut) {
    try { return JSON.parse(localStorage.getItem(cle)) || defaut; } catch (e) { return defaut; }
  }
  function ecrireJSON(cle, v) {
    try { localStorage.setItem(cle, JSON.stringify(v)); } catch (e) {}
  }

  var API = "/api/scores";

  /**
   * Tableau des scores d'un jeu, partage entre tous les joueurs via l'API
   * (`api/server.js`, dix entrees renvoyees). Si l'API ne repond pas
   * (serveur de dev statique, panne), on retombe sur un tableau local a ce
   * navigateur, et le titre le dit.
   *
   * `fin(zone, score, detail)` affiche dans `zone` la saisie du pseudo si le
   * score entre au tableau, sinon le tableau lui-meme.
   */
  function scores(cle) {
    var CLE = "miweb-games:scores:" + cle, MAX = 10;
    function lireLocal() { return lireJSON(CLE, []); }
    function ajouterLocal(score, nom, detail) {
      var l = lireLocal();
      var e = { nom: nom, score: score, detail: detail || "", date: new Date().toISOString().slice(0, 10) };
      l.push(e);
      l.sort(function (a, b) { return b.score - a.score; });
      l = l.slice(0, MAX);
      ecrireJSON(CLE, l);
      return { rang: l.indexOf(e), top: l };
    }
    /** Charge le tableau : `cb(liste, partage)`, partage=false en repli local. */
    function charger(cb) {
      if (typeof fetch !== "function") return cb(lireLocal(), false);
      fetch(API + "/" + cle, { cache: "no-store" })
        .then(function (r) { return r.ok ? r.json() : Promise.reject(r.status); })
        .then(function (l) { cb(Array.isArray(l) ? l : [], true); })
        .catch(function () { cb(lireLocal(), false); });
    }
    function envoyer(score, nom, detail, cb) {
      fetch(API, {
        method: "POST", cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jeu: cle, nom: nom, score: score, detail: detail })
      })
        .then(function (r) { return r.ok ? r.json() : Promise.reject(r.status); })
        .then(function (rep) { cb(rep, true); })
        .catch(function () { cb(ajouterLocal(score, nom, detail), false); });
    }
    function qualifie(score, l) {
      return score > 0 && (l.length < MAX || score > l[l.length - 1].score);
    }
    function tableau(zone, l, surligne, partage) {
      zone.innerHTML = "";
      var t = document.createElement("table");
      t.className = "scores";
      var cap = document.createElement("caption");
      cap.textContent = !l.length ? "Aucun score pour l'instant." :
        partage ? "Tableau des scores, tous joueurs" : "Tableau des scores, ce navigateur (hors ligne)";
      t.appendChild(cap);
      l.forEach(function (e, i) {
        var tr = document.createElement("tr");
        if (i === surligne) tr.className = "nouveau";
        [String(i + 1), e.nom, String(e.score), e.detail].forEach(function (v, j) {
          var td = document.createElement("td");
          td.textContent = v;
          if (j === 2) td.className = "score";
          tr.appendChild(td);
        });
        t.appendChild(tr);
      });
      zone.appendChild(t);
    }
    function formulaire(zone, score, detail, partage) {
      zone.innerHTML = "";
      var f = document.createElement("form");
      f.className = "initiales";
      var lab = document.createElement("label");
      lab.textContent = "Nouveau score au tableau. Votre pseudo :";
      lab.htmlFor = "pseudo-" + cle;
      var inp = document.createElement("input");
      inp.id = lab.htmlFor;
      inp.maxLength = PSEUDO_MAX; inp.autocomplete = "off"; inp.spellcheck = false;
      inp.placeholder = "Anonyme";
      inp.value = pseudo();
      var b = document.createElement("button");
      b.type = "submit"; b.className = "btn"; b.textContent = "Inscrire";
      f.appendChild(lab); f.appendChild(inp); f.appendChild(b);
      f.addEventListener("submit", function (e) {
        e.preventDefault();
        var nom = pseudo(inp.value) || "Anonyme";
        b.disabled = true; b.textContent = "…";
        envoyer(score, nom, detail, function (rep, ok) {
          tableau(zone, rep.top || [], rep.rang, ok && partage);
          verrouJusqua = Date.now() + 900;
          if (document.activeElement) document.activeElement.blur();
        });
      });
      zone.appendChild(f);
      setTimeout(function () { inp.focus(); inp.select(); }, 50);
    }
    function fin(zone, score, detail) {
      zone.innerHTML = "";
      charger(function (l, partage) {
        if (qualifie(score, l)) formulaire(zone, score, detail, partage);
        else tableau(zone, l, -1, partage);
      });
    }
    return { charger: charger, qualifie: qualifie, tableau: tableau, fin: fin, lire: lireLocal };
  }
  /** Tous les tableaux d'un coup, pour l'accueil : `cb({jeu: liste}, partage)`. */
  scores.tous = function (cb) {
    var local = function () {
      var o = {};
      JEUX.forEach(function (j) { o[j.cle] = lireJSON("miweb-games:scores:" + j.cle, []); });
      cb(o, false);
    };
    if (typeof fetch !== "function") return local();
    fetch(API, { cache: "no-store" })
      .then(function (r) { return r.ok ? r.json() : Promise.reject(r.status); })
      .then(function (o) { cb(o || {}, true); })
      .catch(local);
  };
  scores.JEUX = JEUX;
  scores.pseudo = pseudo;
  scores.verrou = verrou;

  var pix = {
    MONO: MONO, SANS: SANS,
    grille: grille, biseau: biseau, picto: picto,
    tete: tete, agent: agent, balle: balle,
    personne: personne, lookAleatoire: lookAleatoire, CHEVEUX: CHEVEUX, PEAUX: PEAUX,
    texte: texte, texteAjuste: texteAjuste, largeur: largeur,
    damier: damier, cadre: cadre, lueur: lueur
  };

  global.Arcade = { plein: plein, inclinaison: inclinaison, cadrer: cadrer, journal: journal, scores: scores, pix: pix };
})(window);
