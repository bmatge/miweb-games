/**
 * Socle commun aux jeux de miweb-games : plein ecran et pilotage a l'inclinaison.
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
      message: function (t) { bMsg.textContent = t; }
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

  global.Arcade = { plein: plein, inclinaison: inclinaison };
})(window);
