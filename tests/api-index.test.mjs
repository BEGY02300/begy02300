import assert from "node:assert/strict";
import test from "node:test";
import { initializePortfolioApis } from "../api/index.js";

class MemorySessionStorage {
  #values = new Map();
  getItem(key) { return this.#values.get(key) || null; }
  setItem(key, value) { this.#values.set(key, value); }
  clear() { this.#values.clear(); }
}

test("agrège les API disponibles, met à jour la configuration et tolère les erreurs", async () => {
  globalThis.sessionStorage = new MemorySessionStorage();
  globalThis.window = {
    PortfolioApiLoader: {
      loadSteamLibrary: async () => ({
        data: {
          games: [{ name: "Steam game", playtimeMinutes: 45 }],
          totalGames: 1,
          recentGames: [],
          topPlayedGames: []
        },
        source: "api",
        message: ""
      })
    }
  };
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const url = String(input);
    if (url === "/api/roblox") {
      return Response.json({
        data: {
          username: "BEGY504",
          displayName: "Auguste",
          description: "Bio Roblox",
          created: "2020-01-02T00:00:00Z",
          avatarUrl: "https://example.test/roblox.png",
          profileUrl: "https://www.roblox.com/users/6136427497/profile"
        }
      });
    }
    if (url === "/api/discord") {
      return Response.json({
        data: {
          id: "1125783712316002424",
          username: "begy02300",
          displayName: "Auguste",
          avatarUrl: "https://example.test/discord.png",
          bannerUrl: "",
          badges: ["Early Supporter"]
        }
      });
    }
    if (url === "/api/tracker/fortnite" || url === "/api/fortnite") {
      return Response.json({ error: "Not configured" }, { status: 501 });
    }
    if (url === "/api/tracker/bf6" || url === "/api/tracker/r6") {
      return Response.json({
        data: {
          accountName: "BEGY02300",
          avatarUrl: "https://example.test/tracker-avatar.png",
          stats: [{ label: "K/D", value: 1.5 }],
          segments: [{
            type: "weapon",
            title: "Rifle",
            category: "weapons",
            imageUrl: "https://example.test/rifle.png",
            stats: [{ label: "Kills", value: 30 }]
          }]
        }
      });
    }
    assert.match(url, /gitlab\.com\/api\/v4\/users\?username=BEGY02/);
    return Response.json([{
      id: 10,
      username: "BEGY02",
      name: "Auguste GitLab",
      bio: "Projets",
      avatar_url: "https://example.test/gitlab.png",
      web_url: "https://gitlab.com/begy02",
      created_at: "2022-01-02T00:00:00Z"
    }]);
  };

  const config = {
    gamingPlatforms: [{ id: "steam", games: [] }],
    socials: ["Roblox", "Discord", "GitLab"].map((name) => ({
      name,
      username: name,
      url: "https://example.test/profile",
      description: "Statique",
      details: []
    }))
  };

  try {
    const statuses = await initializePortfolioApis(config);
    assert.equal(config.gamingPlatforms[0].games[0], "Steam game");
    assert.equal(config.socials[0].avatarUrl, "https://example.test/roblox.png");
    assert.equal(config.socials[1].profile.badges[0], "Early Supporter");
    assert.equal(config.socials[2].username, "BEGY02");
    assert.equal(config.socials[2].description, "Projets");
    assert.equal(statuses.find((item) => item.id === "tracker-fortnite").ok, false);
    assert.equal(statuses.find((item) => item.id === "tracker-bf6").ok, true);
    assert.equal(statuses.find((item) => item.id === "tracker-r6").ok, true);
    assert.deepEqual(config.trackerStats.bf6, [{ label: "K/D", value: 1.5 }]);
    assert.deepEqual(config.trackerStats.r6, [{ label: "K/D", value: 1.5 }]);
    assert.equal(config.trackerProfiles.r6.avatarUrl, "https://example.test/tracker-avatar.png");
    assert.equal(config.trackerProfiles.r6.segments[0].title, "Rifle");
    assert.equal(window.PORTFOLIO_API_DATA.steam.totalGames, 1);
  } finally {
    globalThis.fetch = originalFetch;
    delete globalThis.sessionStorage;
    delete globalThis.window;
  }
});
