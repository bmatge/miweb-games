/**
 * API des scores de miweb-games : un fichier JSON, zero dependance.
 *
 *   GET  /api/scores          -> { "casse-brique": [...], "snake": [...], ... }
 *   GET  /api/scores/<jeu>    -> [ {nom, score, detail, date}, ... ]   (10 au plus)
 *   POST /api/scores          <- { jeu, nom, score, detail }
 *                             -> { rang, top }   (rang dans la liste complete, 0 = premier)
 *
 * Cinquante scores conserves par jeu, dix renvoyes. Rien d'autre n'est
 * enregistre : ni adresse, ni navigateur. La limite de debit par adresse
 * vit en memoire et disparait au redemarrage.
 */
"use strict";
const http = require("http");
const fs = require("fs");
const path = require("path");

const FICHIER = process.env.SCORES_FICHIER || "/data/scores.json";
const PORT = +(process.env.PORT || 3000);
const JEUX = ["casse-brique", "snake", "validation", "support"];
const MAX_GARDE = 50, MAX_TOP = 10, PSEUDO_MAX = 14, DETAIL_MAX = 60, SCORE_MAX = 1e6;
const DEBIT_MS = 1500;

let scores = charger();
const derniers = new Map();

function charger() {
  try { return JSON.parse(fs.readFileSync(FICHIER, "utf8")) || {}; }
  catch (e) { return {}; }
}
function sauver() {
  // Ecriture atomique : un fichier a moitie ecrit au mauvais moment
  // effacerait tous les scores au prochain chargement.
  fs.mkdirSync(path.dirname(FICHIER), { recursive: true });
  const tmp = FICHIER + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(scores));
  fs.renameSync(tmp, FICHIER);
}
function top(jeu) { return (scores[jeu] || []).slice(0, MAX_TOP); }
function tous() {
  const o = {};
  for (const j of JEUX) o[j] = top(j);
  return o;
}

function propre(s, max) {
  return String(s || "").replace(/[\u0000-\u001f<>]/g, "").replace(/\s+/g, " ").trim().slice(0, max);
}

function repondre(res, code, corps) {
  const json = JSON.stringify(corps);
  res.writeHead(code, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Content-Length": Buffer.byteLength(json)
  });
  res.end(json);
}

function lireCorps(req, max, cb) {
  let data = "";
  req.on("data", c => { data += c; if (data.length > max) { req.destroy(); } });
  req.on("end", () => cb(data));
}

const serveur = http.createServer((req, res) => {
  const url = new URL(req.url, "http://x");
  const chemin = url.pathname.replace(/\/+$/, "");

  if (req.method === "GET" && chemin === "/api/scores") return repondre(res, 200, tous());
  if (req.method === "GET" && chemin.startsWith("/api/scores/")) {
    const jeu = chemin.slice("/api/scores/".length);
    if (!JEUX.includes(jeu)) return repondre(res, 404, { erreur: "jeu inconnu" });
    return repondre(res, 200, top(jeu));
  }
  if (req.method === "GET" && chemin === "/api/sante") return repondre(res, 200, { ok: true });

  if (req.method === "POST" && chemin === "/api/scores") {
    // L'adresse ne sert qu'a freiner, elle n'est jamais ecrite.
    const ip = (req.headers["x-forwarded-for"] || req.socket.remoteAddress || "").split(",")[0].trim();
    const maintenant = Date.now();
    if (derniers.get(ip) > maintenant - DEBIT_MS) return repondre(res, 429, { erreur: "trop vite" });
    derniers.set(ip, maintenant);
    if (derniers.size > 5000) derniers.clear();

    return lireCorps(req, 2048, data => {
      let corps;
      try { corps = JSON.parse(data); } catch (e) { return repondre(res, 400, { erreur: "JSON attendu" }); }
      const jeu = corps.jeu, score = Math.round(Number(corps.score));
      if (!JEUX.includes(jeu)) return repondre(res, 400, { erreur: "jeu inconnu" });
      if (!Number.isFinite(score) || score <= 0 || score > SCORE_MAX) return repondre(res, 400, { erreur: "score invalide" });
      const entree = {
        nom: propre(corps.nom, PSEUDO_MAX) || "Anonyme",
        score,
        detail: propre(corps.detail, DETAIL_MAX),
        date: new Date().toISOString().slice(0, 10)
      };
      const liste = scores[jeu] || (scores[jeu] = []);
      liste.push(entree);
      // Tri stable : a score egal, le plus ancien garde sa place.
      liste.sort((a, b) => b.score - a.score);
      const rang = liste.indexOf(entree);
      if (liste.length > MAX_GARDE) liste.length = MAX_GARDE;
      try { sauver(); } catch (e) { console.error("sauvegarde impossible :", e.message); }
      return repondre(res, 201, { rang: rang < MAX_GARDE ? rang : -1, top: top(jeu) });
    });
  }

  repondre(res, 404, { erreur: "introuvable" });
});

serveur.listen(PORT, () => console.log("scores : " + FICHIER + " sur :" + PORT));
