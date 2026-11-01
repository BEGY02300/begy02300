import { fetchCached, fetchJson } from "./shared.js";

const USERNAME = "BEGY02";
const CACHE_AGE_MS = 30 * 60 * 1000;

export async function fetchData() {
  return fetchCached("portfolio-api-gitlab", CACHE_AGE_MS, async () => {
    const url = new URL("https://gitlab.com/api/v4/users");
    url.searchParams.set("username", USERNAME);
    const users = await fetchJson(url);
    const user = Array.isArray(users)
      ? users.find((item) => item.username.toLowerCase() === USERNAME.toLowerCase())
      : null;

    if (!user) throw new Error("Le profil GitLab demandé est introuvable.");

    return {
      username: user.username,
      displayName: user.name || user.username,
      description: user.bio || "",
      avatarUrl: user.avatar_url || "",
      profileUrl: user.web_url || `https://gitlab.com/${USERNAME}`,
      created: user.created_at || ""
    };
  });
}
