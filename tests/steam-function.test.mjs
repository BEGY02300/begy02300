import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test, { afterEach } from "node:test";

const source = await readFile(
  new URL("../functions/api/steam.js", import.meta.url),
  "utf8"
);
const { onRequest } = await import(
  `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`
);
const originalFetch = globalThis.fetch;
const originalCaches = globalThis.caches;

afterEach(() => {
  globalThis.fetch = originalFetch;
  globalThis.caches = originalCaches;
});

function request(path = "/api/steam", options = {}) {
  return new Request(`https://portfolio.example${path}`, {
    headers: { Origin: "https://portfolio.example" },
    ...options
  });
}

function context(req, env = {}) {
  return { request: req, env };
}

test("renvoie 501 sans secrets et sans appeler Steam si la config manque", async () => {
  let fetchCalled = false;
  globalThis.fetch = async () => {
    fetchCalled = true;
    throw new Error("Unexpected request");
  };

  const response = await onRequest(context(request()));
  assert.equal(response.status, 501);
  assert.equal(fetchCalled, false);
  assert.equal(response.headers.get("Access-Control-Allow-Origin"), "https://portfolio.example");
  assert.deepEqual(await response.json(), {
    error: "L’API Steam n’est pas configurée."
  });
});

test("normalise les jeux, trie les temps de jeu et ne renvoie pas la clé", async () => {
  globalThis.caches = {
    default: {
      match: async () => null,
      put: async () => {}
    }
  };
  globalThis.fetch = async (input) => {
    const url = new URL(input);
    assert.equal(url.origin, "https://api.steampowered.com");
    assert.equal(url.searchParams.get("key"), "test-secret");
    assert.equal(url.searchParams.get("steamid"), "76561198612871711");
    return Response.json({
      response: {
        game_count: 2,
        games: [
          { appid: 20, name: "Second", playtime_forever: 60, playtime_2weeks: 5 },
          { appid: 10, name: "First", playtime_forever: 120, playtime_2weeks: 15 }
        ]
      }
    });
  };

  const response = await onRequest(context(request(), {
    STEAM_API_KEY: "test-secret",
    STEAM_ID: "76561198612871711"
  }));
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Cache-Control"), "public, max-age=900");
  assert.equal(body.data.totalGames, 2);
  assert.equal(body.data.games[0].playtimeMinutes, 60);
  assert.equal(body.data.recentGames[0].name, "First");
  assert.equal(body.data.topPlayedGames[0].name, "First");
  assert.equal(JSON.stringify(body).includes("test-secret"), false);
});

test("renvoie 502 et une erreur générique si Steam limite ou refuse la requête", async () => {
  globalThis.fetch = async () => new Response("rate limited", { status: 429 });

  const response = await onRequest(context(request(), {
    STEAM_API_KEY: "test-secret",
    STEAM_ID: "76561198612871711"
  }));

  assert.equal(response.status, 502);
  assert.deepEqual(await response.json(), {
    error: "Steam est indisponible ou le profil ne publie pas sa bibliothèque."
  });
});

test("refuse les SteamID64 invalides et les méthodes autres que GET", async () => {
  const invalidId = await onRequest(context(request(), {
    STEAM_API_KEY: "test-secret",
    STEAM_ID: "not-an-id"
  }));
  const wrongMethod = await onRequest(context(request("/", { method: "POST" })));

  assert.equal(invalidId.status, 501);
  assert.equal(wrongMethod.status, 405);
});

test("autorise le preflight de même origine et refuse une origine externe", async () => {
  const allowed = await onRequest(context(request("/", { method: "OPTIONS" })));
  const denied = await onRequest(context(new Request("https://portfolio.example/api/steam", {
    method: "OPTIONS",
    headers: { Origin: "https://other.example" }
  })));

  assert.equal(allowed.status, 204);
  assert.equal(allowed.headers.get("Access-Control-Allow-Origin"), "https://portfolio.example");
  assert.equal(denied.status, 403);
  assert.equal(denied.headers.get("Access-Control-Allow-Origin"), null);
});

test("sert la réponse en cache sans rappeler Steam", async () => {
  let fetchCalled = false;
  globalThis.caches = {
    default: {
      match: async () => Response.json({ data: { games: [], totalGames: 0 } }),
      put: async () => {}
    }
  };
  globalThis.fetch = async () => {
    fetchCalled = true;
    throw new Error("Cache was not used");
  };

  const response = await onRequest(context(request(), {
    STEAM_API_KEY: "test-secret",
    STEAM_ID: "76561198612871711"
  }));

  assert.equal(response.status, 200);
  assert.equal(fetchCalled, false);
  assert.equal(response.headers.get("Access-Control-Allow-Origin"), "https://portfolio.example");
});
