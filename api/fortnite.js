import { fetchCached, fetchJson } from "./shared.js";

const CACHE_AGE_MS = 15 * 60 * 1000;

export async function fetchData() {
  return fetchCached("portfolio-api-fortnite", CACHE_AGE_MS, async () => {
    const payload = await fetchJson("/api/fortnite");
    if (!payload || !payload.data || !payload.data.stats) {
      throw new Error("La réponse Fortnite ne contient pas les statistiques attendues.");
    }
    return payload.data;
  });
}
