const USER_ID = "6136427497";
const CACHE_TTL_SECONDS = 1800;
const ROBLOX_PROFILE_URL = "https://users.roblox.com/v1/users";
const ROBLOX_AVATAR_URL = "https://thumbnails.roblox.com/v1/users/avatar";

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

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    signal: AbortSignal.timeout(8000),
    headers: { Accept: "application/json", ...options.headers }
  });
  if (!response.ok) throw new Error(`Roblox API returned ${response.status}.`);
  return response.json();
}

export async function onRequest({ request }) {
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

  const cache = typeof caches === "undefined" ? null : caches.default;
  const cacheKey = new Request(new URL("/api/roblox", request.url));
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
      console.warn("Roblox cache read failed.");
    }
  }

  try {
    const [usersPayload, thumbnailsPayload] = await Promise.all([
      fetchJson(ROBLOX_PROFILE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userIds: [USER_ID], excludeBannedUsers: false })
      }),
      fetchJson(
        `${ROBLOX_AVATAR_URL}?userIds=${USER_ID}&size=420x420&format=Png&isCircular=false`
      )
    ]);

    const user = Array.isArray(usersPayload.data)
      ? usersPayload.data.find((item) => String(item.id) === USER_ID)
      : null;
    const avatar = Array.isArray(thumbnailsPayload.data)
      ? thumbnailsPayload.data.find((item) => String(item.targetId) === USER_ID)
      : null;
    if (!user || !avatar || !avatar.imageUrl) {
      throw new Error("Roblox returned an incomplete public profile.");
    }

    const response = jsonResponse(
      request,
      200,
      {
        data: {
          id: USER_ID,
          username: user.name,
          displayName: user.displayName,
          description: user.description || "",
          created: user.created || "",
          hasVerifiedBadge: Boolean(user.hasVerifiedBadge),
          avatarUrl: avatar.imageUrl
        }
      },
      `public, max-age=${CACHE_TTL_SECONDS}`
    );
    if (cache) {
      try {
        await cache.put(cacheKey, response.clone());
      } catch {
        console.warn("Roblox cache write failed.");
      }
    }
    return response;
  } catch {
    return jsonResponse(request, 502, {
      error: "Le profil public Roblox est indisponible."
    });
  }
}
