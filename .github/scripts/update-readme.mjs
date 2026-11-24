import fs from "node:fs";

const LOGIN = "BEGY02300";
const README = "README.md";
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

function replaceBlock(content, name, body) {
  const start = `<!-- ${name}-START -->`;
  const end = `<!-- ${name}-END -->`;
  if (!content.includes(start) || !content.includes(end)) {
    throw new Error(`Marqueurs ${name} introuvables dans le README`);
  }
  const re = new RegExp(`${start}[\\s\\S]*?${end}`);
  return content.replace(re, () => `${start}\n${body}\n${end}`);
}

const bar = (value, max, size = 20) => {
  const filled = max > 0 ? Math.round((value / max) * size) : 0;
  return "█".repeat(filled) + "░".repeat(size - filled);
};

// 1) Dépôts épinglés
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

// 2) Commits par année
async function commitsPerYear() {
  const d = await gql(`query { user(login: "${LOGIN}") { createdAt } }`);
  const firstYear = new Date(d.user.createdAt).getUTCFullYear();
  const now = new Date();
  const thisYear = now.getUTCFullYear();

  const parts = [];
  for (let y = firstYear; y <= thisYear; y++) {
    const from = `${y}-01-01T00:00:00Z`;
    const to = y === thisYear ? now.toISOString() : `${y}-12-31T23:59:59Z`;
    parts.push(
      `y${y}: contributionsCollection(from: "${from}", to: "${to}") { totalCommitContributions }`
    );
  }

  const data = await gql(`query { user(login: "${LOGIN}") { ${parts.join("\n")} } }`);
  const years = [];
  for (let y = firstYear; y <= thisYear; y++) {
    years.push({ year: y, commits: data.user[`y${y}`].totalCommitContributions });
  }

  const shown = years.slice(-6);
  const max = Math.max(...shown.map((y) => y.commits), 1);
  const total = years.reduce((s, y) => s + y.commits, 0);

  const lines = shown.map(
    (y) => `${y.year}  ${bar(y.commits, max)}  ${String(y.commits).padStart(4)}`
  );
  lines.push("", `Total : ${total} commits`);

  return "```text\n" + lines.join("\n") + "\n```";
}

// 3) Langages les plus utilisés (dépôts publics, hors forks)
async function topLanguages() {
  const d = await gql(`query {
    user(login: "${LOGIN}") {
      repositories(first: 100, ownerAffiliations: OWNER, isFork: false, privacy: PUBLIC) {
        nodes {
          languages(first: 10, orderBy: { field: SIZE, direction: DESC }) {
            edges { size node { name } }
          }
        }
      }
    }
  }`);

  const totals = {};
  for (const repo of d.user.repositories.nodes) {
    for (const e of repo.languages.edges) {
      totals[e.node.name] = (totals[e.node.name] || 0) + e.size;
    }
  }

  const sum = Object.values(totals).reduce((a, b) => a + b, 0);
  if (!sum) return "_Pas encore de données._";

  const top = Object.entries(totals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

  const lines = top.map(([name, size]) => {
    const pct = (size / sum) * 100;
    return `${name.padEnd(12)} ${bar(size, top[0][1])}  ${pct.toFixed(1).padStart(5)} %`;
  });

  return "```text\n" + lines.join("\n") + "\n```";
}

async function main() {
  const [pinned, commits, langs] = await Promise.all([
    pinnedRepos(),
    commitsPerYear(),
    topLanguages(),
  ]);

  const original = fs.readFileSync(README, "utf8");
  let updated = original;
  updated = replaceBlock(updated, "PINNED-REPOS", pinned);
  updated = replaceBlock(updated, "COMMITS", commits);
  updated = replaceBlock(updated, "LANGUAGES", langs);

  if (updated !== original) {
    fs.writeFileSync(README, updated);
    console.log("README mis à jour");
  } else {
    console.log("Rien à changer");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
