import { fetchCached } from "./shared.js";

const CACHE_AGE_MS = 15 * 60 * 1000;

export async function fetchData(config) {
  const platform = (config.gamingPlatforms || []).find((item) => item.id === "steam");
  if (!platform) throw new Error("La configuration du compte Steam est absente.");

  return fetchCached(
    "portfolio-api-steam",
    CACHE_AGE_MS,
    async () => {
      if (!window.PortfolioApiLoader) {
        throw new Error("Le chargeur de fallback Steam n’est pas disponible.");
      }

      const result = await window.PortfolioApiLoader.loadSteamLibrary(platform);
      return {
        games: result.data.games,
        totalGames: result.data.totalGames,
        recentGames: result.data.recentGames,
        topPlayedGames: result.data.topPlayedGames,
        activityNote: result.message || result.data.activityNote || "",
        source: result.source
      };
    },
    (data) => data.source === "api"
  );
}
