const CACHE_TTL_SECONDS = 900;
const STEAM_API_URL =
  "https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/";

function corsHeaders(request) {
  const headers = {
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin"
  };
  const origin = request.headers.get("Origin");
  const siteOrigin = new URL(request.url).origin;

  if (origin === siteOrigin) {
    headers["Access-Control-Allow-Origin"] = siteOrigin;
  }

  return headers;
}

function jsonResponse(request, status, body, cacheControl = "no-store") {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(request),
      "Cache-Control": cacheControl,
      "Content-Type": "application/json; charset=utf-8"
    }
  });
}

function normalizeGames(response) {
  if (!Array.isArray(response.games)) {
    throw new Error("Steam did not return a public game list.");
  }

  const games = response.games
    .filter((game) => Number.isInteger(game.appid) && game.name)
    .map((game) => ({
      appId: game.appid,
      name: game.name,
      playtimeMinutes: Math.max(0, Number(game.playtime_forever) || 0),
      recentPlaytimeMinutes: Math.max(0, Number(game.playtime_2weeks) || 0),
      url: `https://store.steampowered.com/app/${game.appid}/`
    }));

  const recentGames = [...games]
    .filter((game) => game.recentPlaytimeMinutes > 0)
    .sort((a, b) => b.recentPlaytimeMinutes - a.recentPlaytimeMinutes)
    .slice(0, 3);
  const topPlayedGames = [...games]
    .sort((a, b) => b.playtimeMinutes - a.playtimeMinutes)
    .slice(0, 3);

  return {
    totalGames: Number.isInteger(response.game_count)
      ? response.game_count
      : games.length,
    games,
    recentGames,
    topPlayedGames
  };
}

export async function onRequest(context) {
  const { request, env } = context;
  const headers = corsHeaders(request);

  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: headers["Access-Control-Allow-Origin"] ? 204 : 403,
      headers
    });
  }
  if (
    request.headers.get("Origin") &&
    request.headers.get("Origin") !== new URL(request.url).origin
  ) {
    return jsonResponse(request, 403, { error: "Origine non autorisée." });
  }

  if (request.method !== "GET") {
    return jsonResponse(request, 405, { error: "Méthode non autorisée." });
  }

  const apiKey = env.STEAM_API_KEY;
  const steamId = env.STEAM_ID;
  if (!apiKey || !steamId) {
    return jsonResponse(request, 501, {
      error: "L’API Steam n’est pas configurée."
    });
  }

  if (!/^\d{17}$/.test(steamId)) {
    return jsonResponse(request, 501, {
      error: "Le SteamID64 configuré est invalide."
    });
  }

  const cache = typeof caches === "undefined" ? null : caches.default;
  const cacheKey = new Request(new URL("/api/steam", request.url), {
    method: "GET"
  });

  if (cache) {
    try {
      const cachedResponse = await cache.match(cacheKey);
      if (cachedResponse) {
        return new Response(cachedResponse.body, {
          status: cachedResponse.status,
          headers: {
            ...Object.fromEntries(cachedResponse.headers),
            ...headers
          }
        });
      }
    } catch {
      console.warn("Steam cache read failed.");
    }
  }

  try {
    const url = new URL(STEAM_API_URL);
    url.searchParams.set("key", apiKey);
    url.searchParams.set("steamid", steamId);
    url.searchParams.set("include_appinfo", "1");
    url.searchParams.set("include_played_free_games", "1");

    const upstream = await fetch(url, {
      signal: AbortSignal.timeout(8000)
    });
    if (!upstream.ok) {
      throw new Error(`Steam API returned ${upstream.status}.`);
    }

    const payload = await upstream.json();
    if (!payload || !payload.response) {
      throw new Error("Steam API returned an invalid response.");
    }

    const data = normalizeGames(payload.response);
    if (data.games.length === 0) {
      data.activityNote = "Aucun jeu dans la bibliothèque Steam publique.";
    }

    const response = jsonResponse(
      request,
      200,
      { data },
      `public, max-age=${CACHE_TTL_SECONDS}`
    );
    if (cache) {
      try {
        await cache.put(cacheKey, response.clone());
      } catch {
        console.warn("Steam cache write failed.");
      }
    }
    return response;
  } catch {
    return jsonResponse(request, 502, {
      error: "Steam est indisponible ou le profil ne publie pas sa bibliothèque."
    });
  }
}
