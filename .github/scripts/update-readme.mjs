import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const LOGIN = "BEGY02300";
const README = "README.md";
const OUT_DIR = "assets/profile";

// Modifie cette liste pour changer le bandeau "stack" du profil.
export const STACK = {
  row1: [
    ["HTML5", "#E34F26"],
    ["CSS3", "#1572B6"],
    ["JavaScript", "#F7DF1E"],
    ["Python", "#3776AB"],
    ["Node.js", "#5FA04E"],
    ["pnpm", "#F69220"],
    ["PowerShell", "#5391FE"],
    ["Git", "#F05032"],
    ["GitHub", "#8b949e"],
    ["VS Code", "#007ACC"],
    ["Docker", "#2496ED"],
  ],
  row2: [
    ["Ollama", "#e6edf3"],
    ["Open WebUI", "#8b949e"],
    ["Qwen", "#a371f7"],
    ["OpenRouter", "#6467F2"],
    ["OpenHands", "#E5A000"],
    ["Cloudflare Pages", "#F38020"],
    ["Supabase", "#3ECF8E"],
    ["PostgreSQL", "#4169E1"],
    ["Netlify", "#00C7B7"],
    ["Blender", "#E87D0D"],
    ["Impression 3D", "#00A98F"],
    ["Klipper", "#d73a49"],
  ],
};

const FONT = `'Segoe UI', 'SF Pro Text', Helvetica, Arial, sans-serif`;

// ---------- Utilitaires ----------

async function gql(query) {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error("GITHUB_TOKEN manquant");
  const res = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: {
      Authorization: `bearer ${token}`,
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

function relTime(iso) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (m < 60) return m < 2 ? "à l'instant" : `il y a ${m} min`;
  if (h < 24) return `il y a ${h} h`;
  if (d < 30) return `il y a ${d} j`;
  const mo = Math.floor(d / 30);
  if (mo < 12) return `il y a ${mo} mois`;
  const y = Math.floor(mo / 12);
  return `il y a ${y} an${y > 1 ? "s" : ""}`;
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

function streaks(days) {
  let longest = 0;
  let run = 0;
  for (const d of days) {
    if (d.count > 0) {
      run++;
      longest = Math.max(longest, run);
    } else run = 0;
  }
  let current = 0;
  let i = days.length - 1;
  if (i >= 0 && days[i].count === 0) i--; // aujourd'hui pas encore compté
  for (; i >= 0 && days[i].count > 0; i--) current++;
  return { current, longest };
}

function wrap(text, max, maxLines) {
  const words = String(text).split(/\s+/).filter(Boolean);
  const lines = [];
  let cur = "";
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (next.length <= max) cur = next;
    else {
      if (cur) lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  if (lines.length > maxLines) {
    lines.length = maxLines;
    lines[maxLines - 1] = lines[maxLines - 1].slice(0, max - 1).trimEnd() + "…";
  }
  return lines;
}

// ---------- Données GitHub ----------

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
      recent: repositories(first: 4, ownerAffiliations: OWNER, isFork: false, privacy: PUBLIC, orderBy: { field: PUSHED_AT, direction: DESC }) {
        nodes { name url pushedAt primaryLanguage { name color } }
      }
      contributionsCollection {
        contributionCalendar { weeks { contributionDays { date contributionCount } } }
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
    }));

  const days = u.contributionsCollection.contributionCalendar.weeks
    .flatMap((w) => w.contributionDays)
    .map((x) => ({ date: x.date, count: x.contributionCount }))
    .sort((a, b) => (a.date < b.date ? -1 : 1));

  return {
    createdAt,
    years,
    stars,
    languages,
    repoCount: u.repositories.totalCount,
    followers: u.followers,
    following: u.following,
    recent: u.recent.nodes,
    streak: streaks(days),
  };
}

const REPO_FIELDS = `name description url stargazerCount pushedAt primaryLanguage { name color }`;

async function projectRepos() {
  const d = await gql(`query {
    user(login: "${LOGIN}") {
      pinnedItems(first: 6, types: REPOSITORY) { nodes { ... on Repository { ${REPO_FIELDS} } } }
    }
  }`);
  const pinned = d.user.pinnedItems.nodes;
  if (pinned.length) return pinned;

  const f = await gql(`query {
    user(login: "${LOGIN}") {
      repositories(first: 4, ownerAffiliations: OWNER, isFork: false, privacy: PUBLIC, orderBy: { field: PUSHED_AT, direction: DESC }) {
        nodes { ${REPO_FIELDS} }
      }
    }
  }`);
  return f.user.repositories.nodes;
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

// ---------- Briques SVG ----------

const ACCENT = `<linearGradient id="accent" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#58a6ff"/><stop offset="0.55" stop-color="#a371f7"/><stop offset="1" stop-color="#f778ba"/></linearGradient>`;

const STYLE = `<style>
.lbl{font:600 11px ${FONT};letter-spacing:1.5px;fill:#8b949e}
.val{font-family:${FONT};font-weight:800;fill:#e6edf3}
.sub{font:12px ${FONT};fill:#8b949e}
.ttl{font:700 16px ${FONT};fill:#e6edf3}
.row{font:13px ${FONT};fill:#8b949e}
.rowb{font:13px ${FONT};fill:#e6edf3}
.num{font:700 13px ${FONT};fill:#e6edf3}
.login{font:11px ${FONT};fill:#8b949e}
.pill{font:500 13px ${FONT};fill:#c9d1d9}
.name{font:700 17px ${FONT};fill:#e6edf3}
</style>`;

const rr = (x, y, w, h, r) =>
  `M${x + r},${y}H${x + w - r}A${r},${r} 0 0 1 ${x + w},${y + r}V${y + h - r}A${r},${r} 0 0 1 ${x + w - r},${y + h}H${x + r}A${r},${r} 0 0 1 ${x},${y + h - r}V${y + r}A${r},${r} 0 0 1 ${x + r},${y}Z`;

// Cadre sombre + liseré lumineux qui court sur la bordure.
const box = (x, y, w, h, begin = 0, r = 14) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="#0d1117" stroke="#30363d"/>` +
  `<path d="${rr(x, y, w, h, r)}" fill="none" stroke="url(#accent)" stroke-width="1.6" stroke-linecap="round" pathLength="100" stroke-dasharray="9 91" opacity="0.9">` +
  `<animate attributeName="stroke-dashoffset" from="0" to="-100" dur="9s" begin="${begin}s" repeatCount="indefinite"/></path>`;

const appear = (inner, begin, dy = 14) =>
  `<g opacity="0">${inner}` +
  `<animate attributeName="opacity" from="0" to="1" begin="${begin}s" dur="0.6s" fill="freeze"/>` +
  `<animateTransform attributeName="transform" type="translate" from="0 ${dy}" to="0 0" begin="${begin}s" dur="0.6s" fill="freeze"/>` +
  `</g>`;

const growBar = (x, y, w, h, fill, begin) =>
  `<rect x="${x}" y="${y}" width="0" height="${h}" rx="${h / 2}" fill="${fill}">` +
  `<animate attributeName="width" from="0" to="${w.toFixed(1)}" begin="${begin}s" dur="1.1s" fill="freeze" calcMode="spline" keyTimes="0;1" keySplines="0.2 0.8 0.2 1"/>` +
  `</rect>`;

const panelHead = (x, y, w, h, title, begin) =>
  box(x, y, w, h, begin) +
  `<rect x="${x + 24}" y="${y}" width="36" height="3" rx="1.5" fill="url(#accent)"/>` +
  `<text x="${x + 24}" y="${y + 36}" class="ttl">${esc(title)}</text>`;

// ---------- Carte d'activité ----------

export function buildActivitySvg(p, avatars) {
  const W = 1000;
  const clips = [];
  let body = "";

  const since = p.createdAt.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Paris",
  });

  // Ligne 1 : tuiles
  const tile = (i, label, value, sub, size = 32, live = false) => {
    const x = i * 204;
    let s =
      box(x, 0, 184, 100, i * 0.9) +
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

  body += tile(0, "Membre depuis", duration(p.createdAt), `depuis le ${since}`, 24, true);
  body += tile(1, "Abonnés", nf.format(p.followers.totalCount), "me suivent");
  body += tile(2, "Abonnements", nf.format(p.following.totalCount), "que je suis");
  body += tile(3, "Étoiles", nf.format(p.stars), `sur ${nf.format(p.repoCount)} dépôts publics`);
  body += tile(
    4,
    "Série en cours",
    `${nf.format(p.streak.current)} j`,
    `record : ${nf.format(p.streak.longest)} j`
  );

  // Ligne 2 : commits par année + langages
  const firstWith = p.years.find((y) => y.commits > 0);
  const fromYear = firstWith ? firstWith.year : p.years[p.years.length - 1].year;
  // On masque les années vides d'avant le premier commit, mais on garde au moins 3 lignes
  // pour que le panneau reste équilibré.
  let shown = p.years.filter((y) => y.year >= fromYear);
  if (shown.length < 3) shown = p.years.slice(-3);
  shown = shown.slice(-6);
  const nLang = p.languages.length;
  const contentH = Math.max(shown.length * 38, nLang * 34, 60);
  const h2 = 62 + contentH + 18;
  const y2 = 124;

  {
    const px = 0;
    let s = panelHead(px, y2, 490, h2, "Commits par année", 1.5);
    const max = Math.max(...shown.map((y) => y.commits), 1);
    shown.forEach((y, i) => {
      const ry = y2 + 62 + i * 38;
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
    let s = panelHead(px, y2, 490, h2, "Langages", 2.4);
    if (!nLang) s += `<text x="${px + 24}" y="${y2 + 84}" class="row">Pas encore de données.</text>`;
    p.languages.forEach((l, i) => {
      const ry = y2 + 62 + i * 34;
      const w = Math.max((l.pct / p.languages[0].pct) * 250, 6);
      s += `<circle cx="${px + 30}" cy="${ry + 8}" r="5" fill="${esc(l.color)}"/>`;
      s += `<text x="${px + 44}" y="${ry + 13}" class="rowb">${esc(l.name)}</text>`;
      s += `<rect x="${px + 150}" y="${ry + 2}" width="250" height="12" rx="6" fill="#161b22"/>`;
      s += growBar(px + 150, ry + 2, w, 12, esc(l.color), 1.0 + i * 0.1);
      s += `<text x="${px + 412}" y="${ry + 13}" class="num">${l.pct.toFixed(1)} %</text>`;
    });
    body += appear(s, 0.75);
  }

  // Ligne 3 : activité récente + communauté
  const y3 = y2 + h2 + 20;
  const advance = (a) => (a.nodes.length ? 100 : 32);
  const extent = (a) => (a.nodes.length ? 80 : 14);
  const communityH = 66 + advance(p.followers) + extent(p.following) + 12;
  const recentH = 62 + Math.max(p.recent.length, 1) * 36 + 14;
  const h3 = Math.max(communityH, recentH);

  {
    const px = 0;
    let s = panelHead(px, y3, 490, h3, "Dernière activité", 3.3);
    if (!p.recent.length) s += `<text x="${px + 24}" y="${y3 + 84}" class="row">Rien pour le moment.</text>`;
    p.recent.forEach((r, i) => {
      const ry = y3 + 62 + i * 36;
      const color = r.primaryLanguage?.color || "#8b949e";
      s += `<circle cx="${px + 30}" cy="${ry + 8}" r="5" fill="${esc(color)}"/>`;
      s += `<text x="${px + 44}" y="${ry + 13}" class="rowb">${esc(r.name)}</text>`;
      s += `<text x="${px + 466}" y="${ry + 13}" text-anchor="end" class="row">${esc(relTime(r.pushedAt))}</text>`;
      if (i < p.recent.length - 1) {
        s += `<rect x="${px + 24}" y="${ry + 27}" width="442" height="1" fill="#21262d"/>`;
      }
    });
    body += appear(s, 1.2);
  }
  {
    const px = 510;
    let s = panelHead(px, y3, 490, h3, "Communauté", 4.2);
    let ly = y3 + 66;
    const section = (title, data, tag) => {
      s += `<text x="${px + 24}" y="${ly}" class="rowb">${esc(title)} · ${nf.format(data.totalCount)}</text>`;
      if (!data.nodes.length) {
        s += `<text x="${px + 150}" y="${ly}" class="row">personne pour le moment</text>`;
      }
      data.nodes.forEach((n, i) => {
        const cx = px + 46 + i * 62;
        const cy = ly + 36;
        const id = `${tag}${i}`;
        clips.push(`<clipPath id="${id}"><circle cx="${cx}" cy="${cy}" r="22"/></clipPath>`);
        const img = avatars.get(n.login);
        if (img) {
          s += `<image href="${img}" x="${cx - 22}" y="${cy - 22}" width="44" height="44" clip-path="url(#${id})"/>`;
        } else {
          s += `<circle cx="${cx}" cy="${cy}" r="22" fill="#161b22"/>`;
          s += `<text x="${cx}" y="${cy + 5}" text-anchor="middle" class="num">${esc(n.login[0].toUpperCase())}</text>`;
        }
        s += `<circle cx="${cx}" cy="${cy}" r="22" fill="none" stroke="#30363d" stroke-width="1.5"/>`;
        const name = n.login.length > 9 ? n.login.slice(0, 8) + "…" : n.login;
        s += `<text x="${cx}" y="${cy + 38}" text-anchor="middle" class="login">${esc(name)}</text>`;
      });
      if (data.totalCount > data.nodes.length) {
        s += `<text x="${px + 46 + data.nodes.length * 62 - 10}" y="${ly + 41}" class="num">+${nf.format(data.totalCount - data.nodes.length)}</text>`;
      }
      ly += advance(data);
    };
    section("Abonnés", p.followers, "fo");
    section("Abonnements", p.following, "fi");
    body += appear(s, 1.35);
  }

  const H = y3 + h3 + 2;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Statistiques GitHub de ${LOGIN}">
<defs>
${ACCENT}
${clips.join("\n")}
</defs>
${STYLE}
${body}
</svg>
`;
}

// ---------- Bandeau stack (défilant) ----------

export function buildStackSvg(stack) {
  const W = 1000;
  const rowH = 36;
  const gap = 12;

  const layout = (items) => {
    let x = 0;
    const pills = items.map(([name, color]) => {
      const w = Math.round(name.length * 7.4 + 50);
      const s =
        `<g transform="translate(${x} 0)">` +
        `<rect width="${w}" height="${rowH}" rx="18" fill="#0d1117" stroke="#30363d"/>` +
        `<circle cx="20" cy="${rowH / 2}" r="4" fill="${esc(color)}"/>` +
        `<text x="34" y="${rowH / 2 + 4.5}" class="pill">${esc(name)}</text></g>`;
      x += w + gap;
      return s;
    });
    return { svg: pills.join(""), total: x };
  };

  const row = (items, y, reverse) => {
    const { svg, total } = layout(items);
    const copies = Math.ceil(W / total) + 1;
    let inner = "";
    for (let k = 0; k < copies; k++) {
      inner += `<g transform="translate(${k * total} 0)">${svg}</g>`;
    }
    const from = reverse ? `-${total} 0` : "0 0";
    const to = reverse ? "0 0" : `-${total} 0`;
    const dur = Math.max(total / 30, 10).toFixed(1);
    return (
      `<g transform="translate(0 ${y})"><g>` +
      `<animateTransform attributeName="transform" type="translate" from="${from}" to="${to}" dur="${dur}s" repeatCount="indefinite"/>` +
      inner +
      `</g></g>`
    );
  };

  const H = 8 + rowH + 12 + rowH + 8;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Technologies utilisées">
<defs>
<linearGradient id="fade" x1="0" y1="0" x2="1" y2="0">
<stop offset="0" stop-color="#000"/><stop offset="0.07" stop-color="#fff"/><stop offset="0.93" stop-color="#fff"/><stop offset="1" stop-color="#000"/>
</linearGradient>
<mask id="edge"><rect width="${W}" height="${H}" fill="url(#fade)"/></mask>
</defs>
${STYLE}
<g mask="url(#edge)">
${row(stack.row1, 8, false)}
${row(stack.row2, 8 + rowH + 12, true)}
</g>
</svg>
`;
}

// ---------- Carte projet ----------

export function buildProjectSvg(r) {
  const W = 490;
  const H = 160;
  const lines = wrap(r.description || "Pas de description.", 56, 2);
  const lang = r.primaryLanguage;
  let s =
    box(1, 1, W - 2, H - 2, 0) +
    `<rect x="24" y="1" width="36" height="3" rx="1.5" fill="url(#accent)"/>` +
    `<text x="24" y="46" class="name">${esc(r.name)}</text>`;
  lines.forEach((l, i) => {
    s += `<text x="24" y="${76 + i * 20}" class="row">${esc(l)}</text>`;
  });

  let x = 24;
  if (lang) {
    s += `<circle cx="${x + 5}" cy="136" r="5" fill="${esc(lang.color || "#8b949e")}"/>`;
    s += `<text x="${x + 18}" y="141" class="row">${esc(lang.name)}</text>`;
    x += 18 + lang.name.length * 7 + 22;
  }
  s += `<text x="${x}" y="141" class="row">★ ${nf.format(r.stargazerCount)}</text>`;
  s += `<text x="${W - 24}" y="141" text-anchor="end" class="row">${esc(relTime(r.pushedAt))}</text>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Projet ${esc(r.name)}">
<defs>
${ACCENT}
</defs>
${STYLE}
${appear(s, 0.1, 10)}
</svg>
`;
}

function projectsBlock(repos) {
  if (!repos.length) return "_Aucun projet à afficher pour le moment._";
  const imgs = repos.map(
    (r, i) =>
      `<a href="${esc(r.url)}"><img src="assets/profile/project-${i}.svg" alt="${esc(r.name)}" width="49%"></a>`
  );
  return `<div align="center">\n${imgs.join("\n")}\n</div>`;
}

// ---------- Main ----------

async function main() {
  const [profile, projects] = await Promise.all([loadProfile(), projectRepos()]);

  const avatars = new Map();
  const people = [...profile.followers.nodes, ...profile.following.nodes];
  await Promise.all(
    people.map(async (n) => {
      if (!avatars.has(n.login)) avatars.set(n.login, await avatarData(n.avatarUrl));
    })
  );

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, "activity.svg"), buildActivitySvg(profile, avatars));
  fs.writeFileSync(path.join(OUT_DIR, "stack.svg"), buildStackSvg(STACK));

  for (const f of fs.readdirSync(OUT_DIR)) {
    if (/^project-\d+\.svg$/.test(f)) fs.unlinkSync(path.join(OUT_DIR, f));
  }
  projects.forEach((r, i) =>
    fs.writeFileSync(path.join(OUT_DIR, `project-${i}.svg`), buildProjectSvg(r))
  );
  console.log(`SVG écrits dans ${OUT_DIR} (${projects.length} projet(s))`);

  const original = fs.readFileSync(README, "utf8");
  const updated = replaceBlock(original, "PINNED-REPOS", projectsBlock(projects));
  if (updated !== original) {
    fs.writeFileSync(README, updated);
    console.log("README mis à jour");
  } else {
    console.log("README inchangé");
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
