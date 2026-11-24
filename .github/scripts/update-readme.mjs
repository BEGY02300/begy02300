import fs from "node:fs";
import path from "node:path";

const LOGIN = "BEGY02300";
const README = "README.md";
const OUT_SVG = "assets/profile/activity.svg";
const TOKEN = process.env.GITHUB_TOKEN;

if (!TOKEN) throw new Error("GITHUB_TOKEN manquant");

async function gql(query) {
  const res = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: {
      Authorization: `bearer ${TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query }),
  });
  const json = await res.json();
  if (json.errors) throw new Error(JSON.stringify(json.errors));
  return json.data;
}

const esc = (s) =>
  String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const nf = new Intl.NumberFormat("fr-FR");

function replaceBlock(content, name, body) {
  const start = `<!-- ${name}-START -->`;
  const end = `<!-- ${name}-END -->`;
  if (!content.includes(start) || !content.includes(end)) {
    throw new Error(`Marqueurs ${name} introuvables dans le README`);
  }
  const re = new RegExp(`${start}[\\s\\S]*?${end}`);
  return content.replace(re, () => `${start}\n${body}\n${end}`);
}

// ---------- Données ----------

async function loadProfile() {
  const base = await gql(`query { user(login: "${LOGIN}") { createdAt } }`);
  const createdAt = new Date(base.user.createdAt);
  const firstYear = createdAt.getUTCFullYear();
  const now = new Date();
  const thisYear = now.getUTCFullYear();

  const yearParts = [];
  for (let y = firstYear; y <= thisYear; y++) {
    const from = `${y}-01-01T00:00:00Z`;
    const to = y === thisYear ? now.toISOString() : `${y}-12-31T23:59:59Z`;
    yearParts.push(
      `y${y}: contributionsCollection(from: "${from}", to: "${to}") { totalCommitContributions }`
    );
  }

  const d = await gql(`query {
    user(login: "${LOGIN}") {
      followers(first: 6) { totalCount nodes { login avatarUrl } }
      following(first: 6) { totalCount nodes { login avatarUrl } }
      repositories(first: 100, ownerAffiliations: OWNER, isFork: false, privacy: PUBLIC) {
        totalCount
        nodes {
          stargazerCount
          languages(first: 10, orderBy: { field: SIZE, direction: DESC }) {
            edges { size node { name color } }
          }
        }
      }
      ${yearParts.join("\n")}
    }
  }`);
  const u = d.user;

  const years = [];
  for (let y = firstYear; y <= thisYear; y++) {
    years.push({ year: y, commits: u[`y${y}`].totalCommitContributions });
  }

  const stars = u.repositories.nodes.reduce((s, r) => s + r.stargazerCount, 0);

  const langTotals = {};
  for (const repo of u.repositories.nodes) {
    for (const e of repo.languages.edges) {
      const l = (langTotals[e.node.name] ||= { size: 0, color: e.node.color });
      l.size += e.size;
    }
  }
  const langSum = Object.values(langTotals).reduce((a, l) => a + l.size, 0);
  const languages = Object.entries(langTotals)
    .sort((a, b) => b[1].size - a[1].size)
    .slice(0, 7)
    .map(([name, l]) => ({
      name,
      color: l.color || "#8b949e",
      pct: langSum ? (l.size / langSum) * 100 : 0,
      size: l.size,
    }));

  return {
    createdAt,
    years,
    stars,
    languages,
    repoCount: u.repositories.totalCount,
    followers: u.followers,
    following: u.following,
  };
}

async function avatarData(url) {
  try {
    const u = new URL(url);
    u.searchParams.set("s", "96");
    const res = await fetch(u);
    if (!res.ok) return null;
    const type = res.headers.get("content-type") || "image/png";
    const buf = Buffer.from(await res.arrayBuffer());
    return `data:${type};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

function duration(from) {
  const now = new Date();
  let months =
    (now.getUTCFullYear() - from.getUTCFullYear()) * 12 +
    (now.getUTCMonth() - from.getUTCMonth());
  if (now.getUTCDate() < from.getUTCDate()) months -= 1;
  months = Math.max(months, 0);
  const y = Math.floor(months / 12);
  const m = months % 12;
  const parts = [];
  if (y) parts.push(`${y} an${y > 1 ? "s" : ""}`);
  if (m) parts.push(`${m} mois`);
  return parts.join(" ") || "< 1 mois";
}

// ---------- SVG animé ----------

function buildSvg(p, avatars) {
  const W = 1000;
  const H = 610;
  const FONT = `'Segoe UI', 'SF Pro Text', Helvetica, Arial, sans-serif`;
  const clips = [];

  const appear = (inner, begin, dy = 14) =>
    `<g opacity="0">${inner}` +
    `<animate attributeName="opacity" from="0" to="1" begin="${begin}s" dur="0.6s" fill="freeze"/>` +
    `<animateTransform attributeName="transform" type="translate" from="0 ${dy}" to="0 0" begin="${begin}s" dur="0.6s" fill="freeze"/>` +
    `</g>`;

  const growBar = (x, y, w, h, fill, begin) =>
    `<rect x="${x}" y="${y}" width="0" height="${h}" rx="${h / 2}" fill="${fill}">` +
    `<animate attributeName="width" from="0" to="${w.toFixed(1)}" begin="${begin}s" dur="1.1s" fill="freeze" calcMode="spline" keyTimes="0;1" keySplines="0.2 0.8 0.2 1"/>` +
    `</rect>`;

  const panel = (x, y, w, h, title) =>
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="14" fill="#0d1117" stroke="#30363d"/>` +
    `<rect x="${x + 24}" y="${y}" width="36" height="3" rx="1.5" fill="url(#accent)"/>` +
    `<text x="${x + 24}" y="${y + 36}" class="ttl">${esc(title)}</text>`;

  const tile = (i, label, value, sub, size = 32, live = false) => {
    const x = i * 204;
    let s =
      `<rect x="${x}" y="0" width="184" height="100" rx="14" fill="#0d1117" stroke="#30363d"/>` +
      `<rect x="${x + 20}" y="0" width="36" height="3" rx="1.5" fill="url(#accent)"/>` +
      `<text x="${x + 20}" y="30" class="lbl">${esc(label.toUpperCase())}</text>` +
      `<text x="${x + 20}" y="66" class="val" font-size="${size}">${esc(value)}</text>` +
      `<text x="${x + 20}" y="86" class="sub">${esc(sub)}</text>`;
    if (live) {
      s +=
        `<circle cx="${x + 162}" cy="24" r="4" fill="#3fb950">` +
        `<animate attributeName="opacity" values="1;0.25;1" dur="2s" repeatCount="indefinite"/></circle>`;
    }
    return appear(s, 0.1 + i * 0.1, 10);
  };

  const since = p.createdAt.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Paris",
  });
  const totalCommits = p.years.reduce((s, y) => s + y.commits, 0);

  let body = "";

  // Ligne 1 : tuiles
  body += tile(0, "Membre depuis", duration(p.createdAt), `depuis le ${since}`, 24, true);
  body += tile(1, "Abonnés", nf.format(p.followers.totalCount), "me suivent");
  body += tile(2, "Abonnements", nf.format(p.following.totalCount), "que je suis");
  body += tile(3, "Étoiles", nf.format(p.stars), "sur mes dépôts publics");
  body += tile(4, "Dépôts publics", nf.format(p.repoCount), `${nf.format(totalCommits)} commits au total`);

  // Ligne 2 : commits + langages
  {
    const px = 0;
    const py = 124;
    let s = panel(px, py, 490, 310, "Commits par année");
    const shown = p.years.slice(-6);
    const max = Math.max(...shown.map((y) => y.commits), 1);
    shown.forEach((y, i) => {
      const ry = py + 66 + i * 38;
      const w = y.commits > 0 ? Math.max((y.commits / max) * 330, 8) : 0;
      s += `<text x="${px + 24}" y="${ry + 15}" class="row">${y.year}</text>`;
      s += `<rect x="${px + 76}" y="${ry}" width="330" height="20" rx="10" fill="#161b22"/>`;
      if (w > 0) s += growBar(px + 76, ry, w, 20, "url(#accent)", 0.9 + i * 0.12);
      s += `<text x="${px + 418}" y="${ry + 15}" class="num">${nf.format(y.commits)}</text>`;
    });
    body += appear(s, 0.6);
  }
  {
    const px = 510;
    const py = 124;
    let s = panel(px, py, 490, 310, "Langages les plus utilisés");
    if (!p.languages.length) {
      s += `<text x="${px + 24}" y="${py + 80}" class="row">Pas encore de données.</text>`;
    }
    p.languages.forEach((l, i) => {
      const ry = py + 64 + i * 34;
      const w = Math.max((l.pct / p.languages[0].pct) * 250, 6);
      s += `<circle cx="${px + 30}" cy="${ry + 8}" r="5" fill="${esc(l.color)}"/>`;
      s += `<text x="${px + 44}" y="${ry + 13}" class="rowb">${esc(l.name)}</text>`;
      s += `<rect x="${px + 150}" y="${ry + 2}" width="250" height="12" rx="6" fill="#161b22"/>`;
      s += growBar(px + 150, ry + 2, w, 12, esc(l.color), 1.0 + i * 0.1);
      s += `<text x="${px + 412}" y="${ry + 13}" class="num">${l.pct.toFixed(1)} %</text>`;
    });
    body += appear(s, 0.75);
  }

  // Ligne 3 : abonnés / abonnements
  const people = (px, py, title, data, tag, begin) => {
    let s = panel(px, py, 490, 150, `${title} · ${nf.format(data.totalCount)}`);
    if (!data.nodes.length) {
      s += `<text x="${px + 24}" y="${py + 90}" class="row">Personne pour le moment.</text>`;
    }
    data.nodes.forEach((n, i) => {
      const cx = px + 50 + i * 74;
      const cy = py + 78;
      const id = `${tag}${i}`;
      clips.push(`<clipPath id="${id}"><circle cx="${cx}" cy="${cy}" r="26"/></clipPath>`);
      const img = avatars.get(n.login);
      if (img) {
        s += `<image href="${img}" x="${cx - 26}" y="${cy - 26}" width="52" height="52" clip-path="url(#${id})"/>`;
      } else {
        s += `<circle cx="${cx}" cy="${cy}" r="26" fill="#161b22"/>`;
        s += `<text x="${cx}" y="${cy + 6}" text-anchor="middle" class="num">${esc(n.login[0].toUpperCase())}</text>`;
      }
      s += `<circle cx="${cx}" cy="${cy}" r="26" fill="none" stroke="#30363d" stroke-width="1.5"/>`;
      const name = n.login.length > 10 ? n.login.slice(0, 9) + "…" : n.login;
      s += `<text x="${cx}" y="${cy + 46}" text-anchor="middle" class="login">${esc(name)}</text>`;
    });
    return appear(s, begin);
  };
  body += people(0, 454, "Abonnés", p.followers, "fo", 1.2);
  body += people(510, 454, "Abonnements", p.following, "fi", 1.35);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Statistiques GitHub de ${LOGIN}">
<defs>
<linearGradient id="accent" x1="0" y1="0" x2="1" y2="0">
<stop offset="0" stop-color="#58a6ff"/>
<stop offset="0.55" stop-color="#a371f7"/>
<stop offset="1" stop-color="#f778ba"/>
</linearGradient>
${clips.join("\n")}
</defs>
<style>
.lbl{font:600 11px ${FONT};letter-spacing:1.5px;fill:#8b949e}
.val{font-family:${FONT};font-weight:800;fill:#e6edf3}
.sub{font:12px ${FONT};fill:#8b949e}
.ttl{font:700 16px ${FONT};fill:#e6edf3}
.row{font:13px ${FONT};fill:#8b949e}
.rowb{font:13px ${FONT};fill:#e6edf3}
.num{font:700 13px ${FONT};fill:#e6edf3}
.login{font:11px ${FONT};fill:#8b949e}
</style>
${body}
</svg>
`;
}

// ---------- Dépôts épinglés ----------

async function pinnedRepos() {
  const d = await gql(`query {
    user(login: "${LOGIN}") {
      pinnedItems(first: 6, types: REPOSITORY) {
        nodes {
          ... on Repository {
            name description url stargazerCount
            primaryLanguage { name }
          }
        }
      }
    }
  }`);
  const repos = d.user.pinnedItems.nodes;
  if (!repos.length) return "_Aucun dépôt épinglé pour le moment._";

  const rows = repos.map((r) => {
    const desc = (r.description || "Pas de description")
      .replace(/\|/g, "\\|")
      .replace(/\r?\n/g, " ");
    return `| [${r.name}](${r.url}) | ${desc} | ${r.primaryLanguage?.name || "—"} | ⭐ ${r.stargazerCount} |`;
  });

  return [
    "| Dépôt | Description | Langage | Étoiles |",
    "|---|---|---|---|",
    ...rows,
  ].join("\n");
}

// ---------- Main ----------

async function main() {
  const [profile, pinned] = await Promise.all([loadProfile(), pinnedRepos()]);

  const people = [...profile.followers.nodes, ...profile.following.nodes];
  const avatars = new Map();
  await Promise.all(
    people.map(async (n) => {
      if (!avatars.has(n.login)) avatars.set(n.login, await avatarData(n.avatarUrl));
    })
  );

  fs.mkdirSync(path.dirname(OUT_SVG), { recursive: true });
  fs.writeFileSync(OUT_SVG, buildSvg(profile, avatars));
  console.log(`SVG écrit : ${OUT_SVG}`);

  const original = fs.readFileSync(README, "utf8");
  const updated = replaceBlock(original, "PINNED-REPOS", pinned);
  if (updated !== original) {
    fs.writeFileSync(README, updated);
    console.log("README mis à jour");
  } else {
    console.log("README inchangé");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
