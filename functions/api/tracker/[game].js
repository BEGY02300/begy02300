const CACHE_TTL_SECONDS = 600;

const TRACKER_PROFILES = {
  fortnite: {
    title: "fortnite",
    platform: "epic",
    profile: "Begy02300"
  },
  bf6: {
    title: "bf6",
    platform: "ea",
    profile: "1014659847596"
  },
  r6: {
    title: "r6mobile",
    platform: "ign",
    profile: "76fd10e3-bd00-464e-a5fd-05f07f16cbfa"
  }
};

const STAT_FIELDS = [
  { keys: ["kd", "killsDeathsRatio", "killDeathRatio"], label: "K/D", decimals: 2 },
  { keys: ["wins"], label: "Victoires" },
  { keys: ["matches", "matchesPlayed", "gamesPlayed"], label: "Parties" },
  { keys: ["winRate", "winPercentage"], label: "Taux de victoire" },
  { keys: ["kills", "eliminations"], label: "Éliminations" },
  { keys: ["timePlayed", "timePlayedSeconds"], label: "Temps de jeu" }
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

function normalizeStats(payload) {
  const segments = payload && payload.data && payload.data.segments;
  const segment = Array.isArray(segments)
    ? segments.find((item) => item.type === "overview" && item.stats) ||
      segments.find((item) => item.stats)
    : null;
  const stats = segment && segment.stats;
  if (!stats || typeof stats !== "object") {
    throw new Error("Tracker.gg did not return profile statistics.");
  }

  return STAT_FIELDS.flatMap((field) => {
    const key = field.keys.find((candidate) =>
      Object.prototype.hasOwnProperty.call(stats, candidate)
    );
    if (!key) return [];

    const raw = stats[key];
    const value = raw && typeof raw === "object" ? raw.value : raw;
    const displayValue = raw && typeof raw === "object" ? raw.displayValue : "";
    if (Number.isFinite(value)) {
      return [{
        label: field.label,
        value,
        ...(field.decimals ? { decimals: field.decimals } : {}),
        ...(field.label === "Taux de victoire" ? { suffix: " %" } : {})
      }];
    }
    if (typeof displayValue === "string" && displayValue.trim()) {
      return [{ label: field.label, value: displayValue }];
    }
    return [];
  });
}

function safeHttpsUrl(value) {
  if (typeof value !== "string") return "";
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.href : "";
  } catch {
    return "";
  }
}

function readSegmentStats(stats) {
  if (!stats || typeof stats !== "object") return [];
  return Object.entries(stats).flatMap(([key, raw]) => {
    const item = raw && typeof raw === "object" ? raw : { value: raw };
    const label = item.displayName || item.label || item.name ||
      key.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/[_-]+/g, " ");
    const value = typeof item.displayValue === "string" && item.displayValue
      ? item.displayValue
      : Number.isFinite(item.value)
        ? item.value
        : typeof item.value === "string"
          ? item.value
          : "";

    return value === "" ? [] : [{ label: String(label), value }];
  });
}

function normalizeSegments(payload) {
  const source = payload && payload.data && payload.data.segments;
  if (!Array.isArray(source)) return [];

  return source.flatMap((segment) => {
    if (!segment || !segment.stats || typeof segment.stats !== "object") return [];
    const metadata = segment.metadata || {};
    const attributes = segment.attributes || {};
    const type = String(segment.type || "stats");
    const title = metadata.name || metadata.title || attributes.name ||
      attributes.playlistName || type;
    const categoryText = `${type} ${title} ${metadata.category || ""}`.toLowerCase();
    const category = /weapon|arme/.test(categoryText)
      ? "weapons"
      : /rank|unrank|playlist|mode|battle.?royale|zero.?build/.test(categoryText)
        ? "modes"
        : "other";
    const imageUrl = safeHttpsUrl(
      metadata.imageUrl || metadata.iconUrl || metadata.avatarUrl ||
      attributes.imageUrl || attributes.iconUrl
    );
    const stats = readSegmentStats(segment.stats);

    return stats.length
      ? [{ type, title: String(title), category, imageUrl, stats }]
      : [];
  });
}

function getAvatarUrl(payload) {
  const data = payload && payload.data;
  const platformInfo = data && data.platformInfo;
  const metadata = data && data.metadata;
  return safeHttpsUrl(
    (platformInfo && (platformInfo.avatarUrl || platformInfo.avatar)) ||
    (metadata && (metadata.avatarUrl || metadata.avatar)) ||
    ""
  );
}

async function getCached(cache, cacheKey) {
  if (!cache) return null;
  try {
    return await cache.match(cacheKey);
  } catch {
    console.warn("Tracker.gg cache read failed.");
    return null;
  }
}

async function putCached(cache, cacheKey, response) {
  if (!cache) return;
  try {
    await cache.put(cacheKey, response.clone());
  } catch {
    console.warn("Tracker.gg cache write failed.");
  }
}

export async function onRequest({ request, env, params }) {
  const headers = corsHeaders(request);
  const origin = request.headers.get("Origin");
  const siteOrigin = new URL(request.url).origin;

  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: origin && origin !== siteOrigin ? 403 : 204,
      headers
    });
  }
  if (origin && origin !== siteOrigin) {
    return jsonResponse(request, 403, { error: "Origine non autorisée." });
  }
  if (request.method !== "GET") {
    return jsonResponse(request, 405, { error: "Méthode non autorisée." });
  }

  const profile = TRACKER_PROFILES[params.game];
  if (!profile) {
    return jsonResponse(request, 404, { error: "Jeu Tracker.gg non pris en charge." });
  }
  const apiKey = env.TRACKER_API_KEY || env.TRACKER_GG;
  if (!apiKey) {
    return jsonResponse(request, 501, { error: "La clé Tracker.gg n’est pas configurée." });
  }

  const cache = typeof caches === "undefined" ? null : caches.default;
  const cacheKey = new Request(
    new URL(`/api/tracker/${params.game}?schema=2`, request.url)
  );
  const cached = await getCached(cache, cacheKey);
  if (cached) {
    return new Response(cached.body, {
      status: cached.status,
      headers: { ...Object.fromEntries(cached.headers), ...headers }
    });
  }

  try {
    const url = new URL(
      `https://public-api.tracker.gg/v2/${profile.title}/standard/profile/` +
      `${profile.platform}/${encodeURIComponent(profile.profile)}`
    );
    const upstream = await fetch(url, {
      headers: {
        Accept: "application/json",
        "TRN-Api-Key": apiKey
      },
      signal: AbortSignal.timeout(8000)
    });
    if (!upstream.ok) {
      throw new Error(`Tracker.gg API returned ${upstream.status}.`);
    }

    const payload = await upstream.json();
    const data = {
      accountName:
        payload.data && payload.data.platformInfo &&
        payload.data.platformInfo.platformUserHandle
          ? payload.data.platformInfo.platformUserHandle
          : profile.profile,
      avatarUrl: getAvatarUrl(payload),
      stats: normalizeStats(payload),
      segments: normalizeSegments(payload)
    };
    if (!data.stats.length) {
      throw new Error("Tracker.gg returned no supported statistics.");
    }

    const response = jsonResponse(
      request,
      200,
      { data },
      `public, max-age=${CACHE_TTL_SECONDS}`
    );
    await putCached(cache, cacheKey, response);
    return response;
  } catch {
    return jsonResponse(request, 502, {
      error: "Les statistiques Tracker.gg sont indisponibles pour ce profil."
    });
  }
}
