import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const source = await readFile(
  new URL("../assets/js/api-loader.js", import.meta.url),
  "utf8"
);

function createLoader(fetchImplementation) {
  const window = {};
  const warnings = [];
  vm.runInNewContext(source, {
    window,
    fetch: fetchImplementation,
    console: { warn: (...args) => warnings.push(args) }
  });
  return { loader: window.PortfolioApiLoader, warnings };
}

test("utilise les jeux renvoyés par la Function Steam", async () => {
  const { loader } = createLoader(async (url) => {
    assert.equal(url, "/api/steam");
    return Response.json({
      data: {
        totalGames: 1,
        games: [{ name: "A game", playtimeMinutes: 45, recentPlaytimeMinutes: 0 }],
        recentGames: [],
        topPlayedGames: []
      }
    });
  });

  const result = await loader.loadSteamLibrary({ games: [] });
  assert.equal(result.source, "api");
  assert.equal(result.data.games[0].name, "A game");
});

test("utilise games.json quand la Function est indisponible", async () => {
  const { loader } = createLoader(async (url) => {
    if (url === "/api/steam") {
      return Response.json({ error: "not configured" }, { status: 501 });
    }
    assert.equal(url, "./games/steam/games.json");
    return Response.json(["Local game"]);
  });

  const result = await loader.loadSteamLibrary({
    games: [],
    gamesFile: "./games/steam/games.json"
  });
  assert.equal(result.source, "fallback");
  assert.equal(result.data.games[0].name, "Local game");
  assert.match(result.message, /liste locale est affichée/);
});

test("conserve les jeux manuels si l’API et le fichier local échouent", async () => {
  const { loader } = createLoader(async () => {
    return Response.json({ error: "unavailable" }, { status: 502 });
  });

  const result = await loader.loadSteamLibrary({
    games: ["Manual game"],
    gamesFile: "./games/steam/games.json"
  });
  assert.equal(result.source, "fallback");
  assert.equal(result.data.games[0].name, "Manual game");
  assert.match(result.message, /liste locale est affichée/);
});
