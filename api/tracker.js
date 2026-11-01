import { fetchCached, fetchJson } from "./shared.js";

const CACHE_AGE_MS = 15 * 60 * 1000;
const TRACKER_GAMES = new Set(["fortnite", "bf6", "r6"]);

export async function fetchData(game) {
  if (!TRACKER_GAMES.has(game)) {
    throw new Error("Jeu Tracker.gg non pris en charge.");
  }

  return fetchCached(`portfolio-api-tracker-v2-${game}`, CACHE_AGE_MS, async () => {
    try {
      const payload = await fetchJson(`/api/tracker/${game}`);
      if (!payload || !payload.data || !Array.isArray(payload.data.stats)) {
        throw new Error("La réponse Tracker.gg ne contient pas les statistiques attendues.");
      }
      return payload.data;
    } catch (trackerError) {
      if (game !== "fortnite") throw trackerError;

      try {
        const fallback = await fetchJson("/api/fortnite");
        if (!fallback || !fallback.data || !Array.isArray(fallback.data.stats)) {
          throw new Error("La réponse Fortnite de secours est invalide.");
        }
        return fallback.data;
      } catch (fallbackError) {
        console.warn("Les API Tracker.gg et Fortnite sont indisponibles.", fallbackError);
        throw trackerError;
      }
    }
  });
}
