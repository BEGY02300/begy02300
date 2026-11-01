# Portfolio BEGY02300

Portfolio statique HTML/CSS/JavaScript, sans framework ni étape de build. Les données
dynamiques sont chargées depuis des API dédiées et mises en cache pour la session du
navigateur. Les secrets ne sont utilisés que par les Cloudflare Pages Functions.

## API intégrées et limites

| Service | Statut | Intégration et repli |
| --- | --- | --- |
| Steam | Officielle, Valve Web API | `IPlayerService/GetOwnedGames` via `/api/steam`. Nécessite une clé API et une bibliothèque publique. Cache Cloudflare de 15 minutes ; jeux manuels ou `games/steam/games.json` en repli. |
| Roblox | Officielle, API publique | Profil et avatar publics par ID via `/api/roblox`. Cache Cloudflare de 30 minutes ; profil statique conservé en cas d’erreur. |
| Discord | Officielle, Discord API v10 | `/users/{id}` via `/api/discord` avec un token de bot côté Function. La réponse dépend des droits et de l’accès du bot ; le profil manuel reste disponible si l’API refuse l’accès. |
| GitLab | Officielle, API publique | Recherche du profil public `BEGY02` via `gitlab.com/api/v4/users`. Cache du résultat dans `sessionStorage` ; profil manuel conservé en cas d’erreur ou de CORS. |
| Fortnite | Communautaire, `fortnite-api.com` | Statistiques Battle Royale via `/api/fortnite`. Nécessite une clé du service et l’Epic Account ID ; l’intégration reste inactive sans ces deux variables. Le lien Tracker est conservé en repli. |
| Replit | Pas d’API publique de profil documentée | Le profil et son lien restent manuels. Les API documentées de Replit concernent les intégrations et ressources de la plateforme, pas la lecture publique de ce profil. |
| PlayStation | Pas d’API Sony publique ; wrappers non officiels | Pas d’intégration active. `psn-api` repose sur une authentification de session susceptible d’expirer et n’est pas incluse ; profil et jeux restent manuels. |
| Epic Games | Endpoints de bibliothèque non documentés | Pas d’intégration active : le token `eg1~` donne accès à une session personnelle et les endpoints peuvent changer. Le lien et le fichier de jeux manuel restent disponibles. |
| Rockstar | Endpoints internes non documentés | Pas de scraping ni de cookie de session ; profil manuel uniquement. |
| Xbox, Ubisoft Connect, EA, Instagram, trackers BF6/R6 | Pas d’API publique exploitable pour cet usage | Liens et données manuels conservés ; aucun scraping n’est tenté. |

La réponse d’une API en erreur n’interrompt pas les autres intégrations : l’agrégateur
utilise `Promise.allSettled()`. Les données réussies sont mises en cache dans
`sessionStorage` (5 à 30 minutes selon le service) ; une réponse déjà en cache est
utilisée en cas d’indisponibilité réseau.

## Structure

```text
.
├── api/
│   ├── discord.js
│   ├── fortnite.js
│   ├── gitlab.js
│   ├── index.js
│   ├── roblox.js
│   ├── shared.js
│   └── steam.js
├── assets/js/api-loader.js
├── functions/api/
│   ├── discord.js
│   ├── fortnite.js
│   ├── roblox.js
│   └── steam.js
├── tests/
├── index.html
└── profile.js
```

Il n’y a pas de build : Cloudflare Pages publie la racine `.` et détecte les
Pages Functions dans `functions/`.

## Développement local

1. Copie `.env.example` vers `.dev.vars` et renseigne les valeurs des API que tu veux
   activer. `.dev.vars` est ignoré par Git et exclu des assets publiés.
2. Lance Wrangler depuis la racine du projet :

   ```sh
   npx wrangler pages dev .
   ```

3. Ouvre l’adresse locale fournie par Wrangler. Teste les routes `/api/steam`,
   `/api/roblox`, `/api/discord` et `/api/fortnite`.
4. Lance les tests sans appel réseau vers les fournisseurs :

   ```sh
   npm test
   ```

### Valeurs à fournir

- `STEAM_API_KEY` (**Secret**) : génère-la sur <https://steamcommunity.com/dev/apikey>.
- `STEAM_ID` (Text) : SteamID64 public de ton profil.
- `DISCORD_BOT_TOKEN` (**Secret**) : token du bot créé sur
  <https://discord.com/developers/applications>. Ne partage jamais ce token. L’API
  peut refuser la lecture d’un profil que le bot ne peut pas consulter.
- `FORTNITE_API_KEY` (**Secret**, optionnel) : clé créée dans le tableau de bord
  <https://dash.fortnite-api.com/>.
- `FORTNITE_ACCOUNT_ID` (Text, optionnel) : Epic Account ID associé au profil Fortnite.
  L’API de stats ne peut pas résoudre le pseudo seul.

Les autres services n’exigent pas de secret dans cette première version. N’ajoute pas
`PSN_NPSSO`, `EPIC_TOKEN` ou `ROCKSTAR_SESSION` : aucun code ne les lit.

## Déploiement automatique Cloudflare Pages

Le workflow `.github/workflows/deploy.yml` exécute `npm test` puis déploie à chaque
push sur `main` avec Wrangler. Le dépôt GitHub doit d’abord recevoir les fichiers de
ce projet et être connecté à un projet Cloudflare Pages **Direct Upload**. Choisis le
nom de projet `begy02300` (ou adapte `--project-name` dans le workflow), puis ajoute
ces valeurs dans **GitHub → Settings → Secrets and variables → Actions** :

- `CLOUDFLARE_API_TOKEN` : token limité au compte concerné et à la permission
  **Cloudflare Pages: Edit** ;
- `CLOUDFLARE_ACCOUNT_ID` : identifiant du compte Cloudflare.

Pour créer le projet Cloudflare Pages, sélectionne **Workers & Pages → Create →
Pages → Direct Upload**. Il n’y a ni commande de build, ni répertoire `dist` : le
workflow publie la racine du projet et ses Functions. Ne connecte pas simultanément
ce projet en mode Git integration : le workflow ci-dessus utilise le déploiement
Direct Upload.

### Secrets des Pages Functions (séparés des secrets GitHub Actions)

Les secrets qui authentifient les API tierces ne servent pas à déployer. Dans le
tableau de bord Cloudflare, ajoute-les sous **Workers & Pages → begy02300 → Settings →
Variables and Secrets → Production**. Utilise le type **Secret** pour
`STEAM_API_KEY`, `DISCORD_BOT_TOKEN` et `FORTNITE_API_KEY`. Ajoute `STEAM_ID` et
`FORTNITE_ACCOUNT_ID` comme variables Text. Configure les mêmes valeurs en Preview
uniquement si les branches de prévisualisation doivent appeler les API.

Ces variables sont lues à l’exécution dans `context.env.*`, jamais pendant le build,
et les clés ne sont jamais renvoyées dans les réponses JSON.

## À noter avant le premier push

Le répertoire de travail utilisé pour préparer ces fichiers est distinct du dépôt
GitHub `BEGY02300/begy02300` : lors de la vérification, celui-ci était vide et le
dépôt Git local parent était `BEGY02300/web-radio-college` sur la branche `teste`.
Vérifie le bon dossier, le dépôt et la branche `main` avant d’y copier ou pousser ce
portfolio. Aucun commit ni déploiement distant n’a été réalisé depuis ce répertoire.
