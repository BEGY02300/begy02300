import { fetchCached, fetchJson } from "./shared.js";

const USER_ID = "6136427497";
const CACHE_AGE_MS = 30 * 60 * 1000;

export async function fetchData() {
  return fetchCached("portfolio-api-roblox", CACHE_AGE_MS, async () => {
    const payload = await fetchJson("/api/roblox");
    const profile = payload && payload.data;
    if (!profile || !profile.username || !profile.avatarUrl) {
      throw new Error("La réponse Roblox ne contient pas le profil attendu.");
    }

    return {
      username: profile.username,
      displayName: profile.displayName || profile.username,
      description: profile.description || "",
      created: profile.created || "",
      hasVerifiedBadge: Boolean(profile.hasVerifiedBadge),
      avatarUrl: profile.avatarUrl,
      profileUrl: `https://www.roblox.com/users/${USER_ID}/profile`
    };
  });
}
