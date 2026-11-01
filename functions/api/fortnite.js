const CACHE_TTL_SECONDS = 900;

function corsHeaders(request) {
  const headers = {
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    Vary: "Origin"
  };
  const origin = request.headers.get("Origin");
  const siteOrigin = new URL(request.url).origin;
  if (origin === siteOrigin) headers["Access-Control-Allow-Origin"] = siteOrigin;
  return headers;
}

function jsonResponse(request, status, body, cacheControl = "no-store") {
  return Response.json(body, {
    status,
    headers: {
      ...corsHeaders(request),
      "Cache-Control": cacheControl
    }
  });
}

export async function onRequest({ request, env }) {
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
  if (!env.FORTNITE_API_KEY || !env.FORTNITE_ACCOUNT_ID) {
    return jsonResponse(request, 501, {
      error: "Les statistiques Fortnite ne sont pas configurées."
    });
  }
  if (!/^[A-Za-z0-9_-]{8,64}$/.test(env.FORTNITE_ACCOUNT_ID)) {
    return jsonResponse(request, 501, {
      error: "L’identifiant de compte Fortnite configuré est invalide."
    });
  }

  const cache = typeof caches === "undefined" ? null : caches.default;
  const cacheKey = new Request(new URL("/api/fortnite", request.url));
  if (cache) {
    try {
      const cached = await cache.match(cacheKey);
      if (cached) {
        return new Response(cached.body, {
          status: cached.status,
          headers: { ...Object.fromEntries(cached.headers), ...headers }
        });
      }
    } catch {
      console.warn("Fortnite cache read failed.");
    }
  }

  try {
    const url = new URL(
      `https://fortnite-api.com/v2/stats/br/v2/epic/${encodeURIComponent(env.FORTNITE_ACCOUNT_ID)}`
    );
    const upstream = await fetch(url, {
      headers: {
        Accept: "application/json",
        Authorization: env.FORTNITE_API_KEY
      },
      signal: AbortSignal.timeout(8000)
    });
    if (!upstream.ok) {
      throw new Error(`Fortnite API returned ${upstream.status}.`);
    }

    const payload = await upstream.json();
    const stats = payload && payload.data && payload.data.stats &&
      payload.data.stats.all && payload.data.stats.all.overall;
    if (!stats || !Number.isFinite(stats.kd) || !Number.isFinite(stats.wins)) {
      throw new Error("Fortnite API returned incomplete public stats.");
    }

    const data = {
      accountName: payload.data.account && payload.data.account.name
        ? payload.data.account.name
        : "",
      stats: [
        { label: "K/D", value: stats.kd, decimals: 2 },
        { label: "Victoires", value: stats.wins },
        { label: "Parties", value: stats.matches || 0 },
        { label: "Taux de victoire", value: stats.winRate || 0, suffix: " %" }
      ]
    };
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
        console.warn("Fortnite cache write failed.");
      }
    }
    return response;
  } catch {
    return jsonResponse(request, 502, {
      error: "Les statistiques publiques Fortnite sont indisponibles."
    });
  }
}
