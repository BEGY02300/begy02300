# Instructions projet — Portfolio BEGY02300

## Stack & environnement
- Site statique HTML/CSS/JS, **sans framework** ni build system.
- Hébergement : **Cloudflare Pages** (déploiement depuis ce dépôt GitHub).
- Logique serveur : **Cloudflare Pages Functions** dans `/functions`.
- Ne jamais introduire de bundler ou de framework JS (React, Vue, etc.) sans demande explicite.

## Architecture & conventions
- La configuration front-end est centralisée dans `profile.js` (`window.PORTFOLIO_CONFIG`).
- Les appels API authentifiés passent **obligatoirement** par une Function dans `/functions/api/<plateforme>.js`. Aucune clé API ne doit apparaître dans le code client.
- Les réponses des Functions renvoient toujours un JSON normalisé : `{ data: ... }` en succès, `{ error: "..." }` en échec, avec le bon code HTTP.
- Chaque appel API côté client est encapsulé dans un `try/catch`. En cas d’échec, le fallback statique (données présentes dans `profile.js` ou fichiers JSON locaux) doit rester affiché, sans casser le reste de la page.
- Séparation claire : `/functions` pour le serveur, `assets/js/api-loader.js` (ou équivalent) pour le chargement côté client.

## Sécurité (impératif)
- Les secrets (clés API, tokens) sont lus **uniquement** via `context.env.*` dans les Functions.
- Ne **jamais** committer de secrets. Maintenir un `.env.example` avec les noms de variables et des commentaires indiquant où les obtenir.
- Les en-têtes CORS doivent renvoyer l’origine explicite (pas `*`) si des credentials sont utilisés.
- Pour les API non officielles (PSN, Epic), prévoir un cache (`caches.default`) pour limiter les appels et les risques de blocage.

## Gestion des erreurs & fallback
- Xbox, Ubisoft, EA, Instagram : **pas d’intégration dynamique**. Conserver le champ `notice` et les données manuelles.
- Les statistiques Tracker.gg de Fortnite, BF6 et R6 Mobile passent par `/api/tracker/<jeu>` et le secret `TRACKER_API_KEY`; conserver les statistiques manuelles en repli.
- Si une Function renvoie 501 (non configurée) ou 502 (API indisponible), le client masque la section dynamique et laisse le fallback statique.

## Style de code
- JavaScript moderne (ES2022+), modules ES (`import`/`export`) côté client si possible.
- Noms de fichiers en kebab-case, fonctions en camelCase, constantes en UPPER_SNAKE_CASE.
- Commenter uniquement les décisions non évidentes (ex. pourquoi un fallback, pourquoi un cache), pas le code trivial.