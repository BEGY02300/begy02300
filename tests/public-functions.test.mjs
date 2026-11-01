import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test, { afterEach } from "node:test";

async function loadFunction(name) {
  const source = await readFile(
    new URL(`../functions/api/${name}.js`, import.meta.url),
    "utf8"
  );
  return import(
    `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`
  );
}

const { onRequest: onRobloxRequest } = await loadFunction("roblox");
const { onRequest: onDiscordRequest } = await loadFunction("discord");
const { onRequest: onFortniteRequest } = await loadFunction("fortnite");
const originalFetch = globalThis.fetch;
const originalCaches = globalThis.caches;

afterEach(() => {
  globalThis.fetch = originalFetch;
  globalThis.caches = originalCaches;
});

function makeRequest(path, options = {}) {
  return new Request(`https://portfolio.example${path}`, {
    headers: { Origin: "https://portfolio.example" },
    ...options
  });
}

test("Roblox Function normalise le profil public et l’avatar officiel", async () => {
  globalThis.fetch = async (input, options) => {
    const url = new URL(input);
    if (url.hostname === "users.roblox.com") {
      assert.equal(options.method, "POST");
      assert.deepEqual(JSON.parse(options.body), {
        userIds: ["6136427497"],
        excludeBannedUsers: false
      });
      return Response.json({
        data: [{
          id: 6136427497,
          name: "BEGY504",
          displayName: "Auguste",
          description: "Profil public",
          created: "2020-01-02T00:00:00Z",
          hasVerifiedBadge: false
        }]
      });
    }

    assert.equal(url.hostname, "thumbnails.roblox.com");
    return Response.json({
      data: [{
        targetId: 6136427497,
        imageUrl: "https://tr.rbxcdn.com/avatar.png"
      }]
    });
  };

  const response = await onRobloxRequest({
    request: makeRequest("/api/roblox"),
    env: {}
  });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.data.username, "BEGY504");
  assert.equal(body.data.avatarUrl, "https://tr.rbxcdn.com/avatar.png");
  assert.equal(body.data.description, "Profil public");
});

test("Discord Function signale le token manquant sans requête réseau", async () => {
  let fetchCalled = false;
  globalThis.fetch = async () => {
    fetchCalled = true;
    throw new Error("Unexpected request");
  };

  const response = await onDiscordRequest({
    request: makeRequest("/api/discord"),
    env: {}
  });

  assert.equal(response.status, 501);
  assert.equal(fetchCalled, false);
  assert.match((await response.json()).error, /pas configurée/);
});

test("Discord Function normalise le profil sans révéler le token", async () => {
  globalThis.fetch = async (input, options) => {
    assert.equal(input, "https://discord.com/api/v10/users/1125783712316002424");
    assert.equal(options.headers.Authorization, "Bot test-discord-token");
    return Response.json({
      id: "1125783712316002424",
      username: "begy02300",
      global_name: "Auguste",
      avatar: "avatar-hash",
      banner: "banner-hash",
      public_flags: 1
    });
  };

  const response = await onDiscordRequest({
    request: makeRequest("/api/discord"),
    env: { DISCORD_BOT_TOKEN: "test-discord-token" }
  });
  const text = await response.text();

  assert.equal(response.status, 200);
  assert.match(text, /Employé Discord/);
  assert.match(text, /cdn\.discordapp\.com\/avatars/);
  assert.equal(text.includes("test-discord-token"), false);
  assert.ok(JSON.parse(text).data.created);
});

test("Fortnite Function renvoie 501 tant que la clé ou l’ID manque", async () => {
  let fetchCalled = false;
  globalThis.fetch = async () => {
    fetchCalled = true;
    throw new Error("Unexpected request");
  };

  const response = await onFortniteRequest({
    request: makeRequest("/api/fortnite"),
    env: {}
  });

  assert.equal(response.status, 501);
  assert.equal(fetchCalled, false);
  assert.match((await response.json()).error, /pas configurées/);
});

test("Fortnite Function masque la clé et normalise les statistiques", async () => {
  globalThis.fetch = async (input, options) => {
    assert.match(String(input), /fortnite-api\.com\/v2\/stats\/br\/v2\/epic\/account-id/);
    assert.equal(options.headers.Authorization, "test-fortnite-key");
    return Response.json({
      data: {
        account: { name: "Begy02300" },
        stats: {
          all: {
            overall: { kd: 1.5, wins: 9, matches: 50, winRate: 18 }
          }
        }
      }
    });
  };

  const response = await onFortniteRequest({
    request: makeRequest("/api/fortnite"),
    env: {
      FORTNITE_API_KEY: "test-fortnite-key",
      FORTNITE_ACCOUNT_ID: "account-id"
    }
  });
  const text = await response.text();
  const body = JSON.parse(text);

  assert.equal(response.status, 200);
  assert.equal(body.data.stats[0].value, 1.5);
  assert.equal(body.data.stats[1].value, 9);
  assert.equal(text.includes("test-fortnite-key"), false);
});

test("les Functions refusent les origines étrangères", async () => {
  const request = new Request("https://portfolio.example/api/discord", {
    headers: { Origin: "https://untrusted.example" }
  });
  const response = await onDiscordRequest({ request, env: {} });

  assert.equal(response.status, 403);
  assert.equal(response.headers.get("Access-Control-Allow-Origin"), null);
});
