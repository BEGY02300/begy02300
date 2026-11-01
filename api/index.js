import * as discord from "./discord.js";
import * as gitlab from "./gitlab.js";
import * as roblox from "./roblox.js";
import * as steam from "./steam.js";
import * as tracker from "./tracker.js";

const API_LOADERS = [
  { id: "steam", load: steam.fetchData },
  { id: "roblox", load: roblox.fetchData },
  { id: "discord", load: discord.fetchData },
  { id: "gitlab", load: gitlab.fetchData },
  { id: "tracker-fortnite", load: () => tracker.fetchData("fortnite") },
  { id: "tracker-bf6", load: () => tracker.fetchData("bf6") },
  { id: "tracker-r6", load: () => tracker.fetchData("r6") }
];

function findSocial(config, name) {
  return (config.socials || []).find(
    (social) => social.name.toLowerCase() === name.toLowerCase()
  );
}

function replaceDetails(social, values) {
  social.details = values
    .filter((item) => item.value)
    .map((item) => ({ label: item.label, value: String(item.value) }));
}

function applyResult(config, id, data) {
  if (id === "steam") {
    const platform = (config.gamingPlatforms || []).find((item) => item.id === "steam");
    if (platform) platform.games = data.games.map((game) => game.name);
    return;
  }

  if (id === "roblox") {
    const social = findSocial(config, "Roblox");
    if (!social) return;
    social.username = data.username;
    social.url = data.profileUrl;
    social.avatarUrl = data.avatarUrl;
    social.profile = data;
    replaceDetails(social, [
      { label: "Identifiant", value: data.username },
      { label: "ID du compte", value: data.id },
      { label: "Nom affiché", value: data.displayName },
      { label: "Compte créé", value: data.created }
    ]);
    return;
  }

  if (id === "discord") {
    const social = findSocial(config, "Discord");
    if (!social) return;
    social.username = data.username;
    social.avatarUrl = data.avatarUrl;
    social.bannerUrl = data.bannerUrl;
    social.profile = data;
    replaceDetails(social, [
      { label: "Identifiant", value: data.username },
      { label: "ID du compte", value: data.id },
      { label: "Nom affiché", value: data.displayName },
      { label: "Compte créé", value: data.created },
      { label: "Badges publics", value: data.badges.join(", ") }
    ]);
    return;
  }

  if (id === "gitlab") {
    const social = findSocial(config, "GitLab");
    if (!social) return;
    social.username = data.username;
    social.url = data.profileUrl;
    social.avatarUrl = data.avatarUrl;
    if (data.description) social.description = data.description;
    social.profile = data;
    replaceDetails(social, [
      { label: "Identifiant", value: data.username },
      { label: "Nom affiché", value: data.displayName },
      { label: "Compte créé", value: data.created }
    ]);
    return;
  }

  if (id.startsWith("tracker-")) {
    const game = id.slice("tracker-".length);
    config.trackerStats = config.trackerStats || {};
    config.trackerStats[game] = data.stats;
    config.trackerProfiles = config.trackerProfiles || {};
    config.trackerProfiles[game] = data;
  }
}

export async function initializePortfolioApis(config = window.PORTFOLIO_CONFIG) {
  if (!config) {
    console.warn("PORTFOLIO_CONFIG est absent ; les API du portfolio sont ignorées.");
    return [];
  }

  const results = await Promise.allSettled(
    API_LOADERS.map((service) => service.load(config))
  );
  const status = [];
  const data = {};

  results.forEach((result, index) => {
    const id = API_LOADERS[index].id;
    if (result.status === "fulfilled") {
      try {
        applyResult(config, id, result.value);
        data[id] = result.value;
        status.push({ id, ok: true, cache: result.value.cache || "network" });
      } catch (error) {
        console.warn(`Les données de ${id} n’ont pas pu être appliquées.`, error);
        status.push({ id, ok: false, error: error.message });
      }
      return;
    }

    console.warn(`Chargement de ${id} ignoré ; le fallback statique est conservé.`, result.reason);
    status.push({ id, ok: false, error: result.reason.message });
  });

  config.apiStatus = status;
  window.PORTFOLIO_API_DATA = data;
  return status;
}
