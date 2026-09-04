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

    function actif() {
      return !!(document.fullscreenElement || document.webkitFullscreenElement) ||
        el.classList.contains("plein");
    }

    function replier(on) {
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
        if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen();
        else if (document.webkitFullscreenElement && document.webkitExitFullscreen) document.webkitExitFullscreen();
        else replier(false);
        return;
      }
      if (natif) {
        var p = (el.requestFullscreen || el.webkitRequestFullscreen).call(el);
        if (p && p.catch) p.catch(function () { replier(true); });
        return;
      }
      replier(true);
    }

    function surChangement() {
      var natifActif = !!(document.fullscreenElement || document.webkitFullscreenElement);
      // Sortie via Echap : nettoyer aussi l'etat du repli.
      if (!natifActif && el.classList.contains("plein") && natif) replier(false);
      else {
        document.body.classList.toggle("plein-actif", natifActif || el.classList.contains("plein"));
        majBouton();
        if (onChange) onChange(actif());
      }
    }

    document.addEventListener("fullscreenchange", surChangement);
    document.addEventListener("webkitfullscreenchange", surChangement);
    if (bouton) bouton.addEventListener("click", basculer);
    majBouton();

    return { basculer: basculer, actif: actif };
  }

  /* ------------------------------------------------------------------ */
  /* Inclinaison (accelerometre)                                         */
  /* ------------------------------------------------------------------ */

  /**
   * Active le pilotage a l'inclinaison.
   *
   * `onTilt` recoit `{gamma, beta}` en degres, deja corriges de l'orientation
   * de l'ecran : gamma > 0 = appareil penche vers la droite, beta > 0 = penche
   * vers l'avant (haut de l'ecran qui s'eloigne).
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
    var actif = false, vu = false;

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

      onTilt({ gamma: gg, beta: bb });
    }

    function majBouton() {
      bouton.textContent = "Inclinaison : " + (actif ? "activée" : "désactivée");
      bouton.setAttribute("aria-pressed", String(actif));
    }

    function demarrer() {
      global.addEventListener("deviceorientation", surOrientation);
      actif = true;
      majBouton();
    }

    bouton.hidden = !besoinPermission;
    majBouton();

    bouton.addEventListener("click", function () {
      if (actif) {
        global.removeEventListener("deviceorientation", surOrientation);
        actif = false;
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
