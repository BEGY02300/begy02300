const USER_ID = "1125783712316002424";
const CACHE_TTL_SECONDS = 1800;
const DISCORD_USER_URL = `https://discord.com/api/v10/users/${USER_ID}`;

const USER_FLAGS = [
  [1 << 0, "Employé Discord"],
  [1 << 1, "Partenaire Discord"],
  [1 << 2, "HypeSquad Events"],
  [1 << 6, "HypeSquad Bravery"],
  [1 << 7, "HypeSquad Brilliance"],
  [1 << 8, "HypeSquad Balance"],
  [1 << 9, "Early Supporter"],
  [1 << 14, "Bug Hunter niveau 2"],
  [1 << 17, "Early Verified Bot Developer"],
  [1 << 18, "Certified Moderator"]
];

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

function discordImage(hash, kind, userId) {
  if (!hash) return "";
  const extension = hash.startsWith("a_") ? "gif" : "png";
  return `https://cdn.discordapp.com/${kind}/${userId}/${hash}.${extension}?size=512`;
}

function creationDateFromSnowflake(id) {
  try {
    const milliseconds = Number((BigInt(id) >> 22n) + 1420070400000n);
    return Number.isFinite(milliseconds) ? new Date(milliseconds).toISOString() : "";
  } catch {
    return "";
  }
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
  if (!env.DISCORD_BOT_TOKEN) {
    return jsonResponse(request, 501, {
      error: "L’API Discord n’est pas configurée."
    });
  }

  const cache = typeof caches === "undefined" ? null : caches.default;
  const cacheKey = new Request(new URL("/api/discord", request.url));
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
      console.warn("Discord cache read failed.");
    }
  }

  try {
    const upstream = await fetch(DISCORD_USER_URL, {
      headers: {
        Accept: "application/json",
        Authorization: `Bot ${env.DISCORD_BOT_TOKEN}`
      },
      signal: AbortSignal.timeout(8000)
    });
    if (!upstream.ok) {
      throw new Error(`Discord API returned ${upstream.status}.`);
    }

    const user = await upstream.json();
    if (!user || user.id !== USER_ID || !user.username) {
      throw new Error("Discord returned an invalid user.");
    }

    const flags = Number(user.public_flags || user.flags || 0);
    const badges = USER_FLAGS
      .filter(([flag]) => (flags & flag) !== 0)
      .map(([, name]) => name);
    const response = jsonResponse(
      request,
      200,
      {
        data: {
          id: user.id,
          username: user.username,
          displayName: user.global_name || user.username,
          created: creationDateFromSnowflake(user.id),
          avatarUrl: discordImage(user.avatar, "avatars", USER_ID),
          bannerUrl: discordImage(user.banner, "banners", USER_ID),
          badges
        }
      },
      `public, max-age=${CACHE_TTL_SECONDS}`
    );
    if (cache) {
      try {
        await cache.put(cacheKey, response.clone());
      } catch {
        console.warn("Discord cache write failed.");
      }
    }
    return response;
  } catch {
    return jsonResponse(request, 502, {
      error: "Le profil Discord est indisponible ou inaccessible avec ce bot."
    });
  }
}
