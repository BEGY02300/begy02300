import { fetchCached, fetchJson } from "./shared.js";

const CACHE_AGE_MS = 30 * 60 * 1000;

export async function fetchData() {
  return fetchCached("portfolio-api-discord", CACHE_AGE_MS, async () => {
    const payload = await fetchJson("/api/discord");
    const profile = payload && payload.data;
    if (!profile || !profile.id || !profile.username) {
      throw new Error("La réponse Discord ne contient pas le profil attendu.");
    }

    return profile;
  });
}
