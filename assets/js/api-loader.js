(function (global) {
  "use strict";

  function normalizeStaticGames(games) {
    return (Array.isArray(games) ? games : [])
      .map(function (game) {
        if (typeof game === "string") {
          return { name: game, playtimeMinutes: 0, recentPlaytimeMinutes: 0 };
        }
        if (!game || typeof game.name !== "string") return null;
        return {
          appId: game.appId,
          name: game.name,
          playtimeMinutes: Number(game.playtimeMinutes) || 0,
          recentPlaytimeMinutes: Number(game.recentPlaytimeMinutes) || 0,
          url: game.url
        };
      })
      .filter(Boolean);
  }

  function summarizeGames(games) {
    return {
      totalGames: games.length,
      games: games,
      recentGames: games
        .filter(function (game) { return game.recentPlaytimeMinutes > 0; })
        .sort(function (a, b) { return b.recentPlaytimeMinutes - a.recentPlaytimeMinutes; })
        .slice(0, 3),
      topPlayedGames: games
        .slice()
        .sort(function (a, b) { return b.playtimeMinutes - a.playtimeMinutes; })
        .slice(0, 3)
    };
  }

  async function fetchJson(url) {
    var response = await fetch(url, {
      headers: { Accept: "application/json" }
    });
    var payload;

    try {
      payload = await response.json();
    } catch {
      throw new Error("La réponse du serveur n’est pas un JSON valide.");
    }

    if (!response.ok) {
      throw new Error(
        payload && payload.error
          ? payload.error
          : "La requête a échoué (" + response.status + ")."
      );
    }

    return payload;
  }

  async function loadStaticFallback(platform) {
    var configuredGames = normalizeStaticGames(platform.games);
    if (configuredGames.length) return summarizeGames(configuredGames);
    if (!platform.gamesFile) return summarizeGames([]);

    var payload = await fetchJson(platform.gamesFile);
    var games = Array.isArray(payload) ? payload : payload && payload.games;
    return summarizeGames(normalizeStaticGames(games));
  }

  async function loadSteamLibrary(platform) {
    try {
      var payload = await fetchJson("/api/steam");
      if (!payload || !payload.data || !Array.isArray(payload.data.games)) {
        throw new Error("La réponse Steam ne contient pas la bibliothèque attendue.");
      }

      return { data: payload.data, source: "api", message: "" };
    } catch (apiError) {
      console.warn("Chargement Steam en direct impossible :", apiError.message);

      try {
        var fallback = await loadStaticFallback(platform);
        return {
          data: fallback,
          source: "fallback",
          message: fallback.games.length
            ? "API Steam indisponible ; la liste locale est affichée."
            : "API Steam indisponible ; aucune liste locale n’est configurée."
        };
      } catch (fallbackError) {
        console.warn("Chargement du fallback Steam impossible :", fallbackError.message);
        var manualGames = normalizeStaticGames(platform.games);
        return {
          data: summarizeGames(manualGames),
          source: "fallback",
          message: manualGames.length
            ? "API Steam indisponible ; les données manuelles sont conservées."
            : "API Steam indisponible et aucun fallback local n’est disponible."
        };
      }
    }
  }

  global.PortfolioApiLoader = {
    loadSteamLibrary: loadSteamLibrary
  };
})(window);
