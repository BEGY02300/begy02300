---
name: cloudflare-function
description: Crée une nouvelle Cloudflare Pages Function dans /functions/api/ pour proxyfier un appel API externe, avec lecture des secrets via context.env, gestion d’erreurs et en-têtes CORS. Utiliser quand on demande d’ajouter ou de modifier une Function pour Steam, Discord, PSN, Epic, Roblox, GitLab ou Replit.
---

# Créer une Cloudflare Pages Function

## Quand utiliser ce skill
- Ajout d’un endpoint `/api/<plateforme>` dans `/functions/api/`.
- Modification d’une Function existante pour changer la source de données ou la gestion d’erreurs.

## Workflow
1. Créer le fichier `/functions/api/<plateforme>.js`.
2. Exporter `async function onRequest(context)`.
3. Lire les secrets via `context.env.NOM_DE_LA_VARIABLE`. Si le secret est absent, renvoyer `Response.json({ error: "Not configured" }, { status: 501 })`.
4. Appeler l’API externe avec `fetch`, en incluant les en-têtes nécessaires.
5. Normaliser la réponse : `{ data: ... }` en succès, `{ error: "..." }` avec un code 502/500 en échec.
6. Ajouter les en-têtes CORS : `Access-Control-Allow-Origin` avec l’origine du site (pas `*` si credentials), et gérer `OPTIONS` si nécessaire.
7. Pour les API non officielles (PSN, Epic), entourer l’appel d’un cache `caches.default` avec une durée adaptée (ex. 600 s).

## Exemple de structure
```js
export async function onRequest(context) {
  const apiKey = context.env.STEAM_API_KEY;
  if (!apiKey) {
    return Response.json({ error: "STEAM_API_KEY not configured" }, { status: 501 });
  }
  try {
    const res = await fetch(`https://api.steampowered.com/...?key=${apiKey}`);
    if (!res.ok) throw new Error(`Upstream ${res.status}`);
    const data = await res.json();
    return Response.json({ data });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 502 });
  }
}