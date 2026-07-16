import { mkdir, writeFile } from "node:fs/promises";

const username = process.env.GITHUB_USERNAME || "JOJOCrazy123";
const token = process.env.GITHUB_TOKEN;
const outputDirectory = process.argv[2] || "assets";

const headers = {
  Accept: "application/vnd.github+json",
  "User-Agent": `${username}-profile-stats`,
  "X-GitHub-Api-Version": "2022-11-28",
  ...(token ? { Authorization: `Bearer ${token}` } : {}),
};

async function github(path) {
  const response = await fetch(`https://api.github.com${path}`, { headers });
  if (!response.ok) {
    throw new Error(`GitHub API ${response.status}: ${await response.text()}`);
  }
  return response.json();
}

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function formatNumber(value) {
  return new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

function frame(content) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="180" viewBox="0 0 480 180" role="img">
  <style>
    .title { fill: #0969da; font: 600 18px -apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif }
    .label { fill: #57606a; font: 400 13px -apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif }
    .value { fill: #24292f; font: 600 18px -apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif }
  </style>
  <rect x="0.5" y="0.5" width="479" height="179" rx="6" fill="#fff" stroke="#d0d7de"/>
${content}
</svg>
`;
}

function statsCard(profile, repositories) {
  const stars = repositories.reduce((total, repository) => total + repository.stargazers_count, 0);
  const forks = repositories.reduce((total, repository) => total + repository.forks_count, 0);
  const values = [
    ["Public repositories", profile.public_repos],
    ["Total stars", stars],
    ["Followers", profile.followers],
    ["Repository forks", forks],
  ];
  const positions = [[28, 72], [254, 72], [28, 132], [254, 132]];
  const rows = values.map(([label, value], index) => {
    const [x, y] = positions[index];
    return `  <text class="label" x="${x}" y="${y}">${escapeXml(label)}</text>
  <text class="value" x="${x}" y="${y + 23}">${escapeXml(formatNumber(value))}</text>`;
  }).join("\n");
  return frame(`  <text class="title" x="24" y="34">Statistics</text>\n${rows}`);
}

const languageColors = {
  C: "#555555", "C++": "#f34b7d", CSS: "#563d7c", Go: "#00add8",
  HTML: "#e34c26", Java: "#b07219", JavaScript: "#f1e05a", Jupyter: "#da5b0b",
  "Jupyter Notebook": "#da5b0b", Kotlin: "#a97bff", Python: "#3572a5",
  Rust: "#dea584", Shell: "#89e051", Swift: "#f05138", TypeScript: "#3178c6",
};
const fallbackColors = ["#0969da", "#8250df", "#1a7f37", "#bf8700", "#cf222e"];

function languagesCard(languageBytes) {
  const languages = Object.entries(languageBytes)
    .sort(([, left], [, right]) => right - left)
    .slice(0, 5);
  const total = languages.reduce((sum, [, bytes]) => sum + bytes, 0);
  let offset = 24;
  const segments = languages.map(([language, bytes], index) => {
    const width = total ? (432 * bytes) / total : 0;
    const segment = `<rect x="${offset.toFixed(2)}" y="51" width="${width.toFixed(2)}" height="8" fill="${languageColors[language] || fallbackColors[index]}"/>`;
    offset += width;
    return segment;
  }).join("\n  ");
  const rows = languages.map(([language, bytes], index) => {
    const percentage = total ? ((bytes / total) * 100).toFixed(1) : "0.0";
    const x = index % 2 === 0 ? 28 : 254;
    const y = 87 + Math.floor(index / 2) * 31;
    const color = languageColors[language] || fallbackColors[index];
    return `  <circle cx="${x + 5}" cy="${y - 4}" r="5" fill="${color}"/>
  <text class="label" x="${x + 17}" y="${y}">${escapeXml(language)} ${percentage}%</text>`;
  }).join("\n");
  return frame(`  <text class="title" x="24" y="34">Languages</text>
  <clipPath id="bar"><rect x="24" y="51" width="432" height="8" rx="4"/></clipPath>
  <g clip-path="url(#bar)">
  ${segments}
  </g>
${rows}`);
}

const profile = await github(`/users/${encodeURIComponent(username)}`);
const repositories = await github(`/users/${encodeURIComponent(username)}/repos?per_page=100&type=owner&sort=updated`);
const sourceRepositories = repositories.filter((repository) => !repository.fork);
const languageResults = await Promise.all(
  sourceRepositories.map((repository) => github(`/repos/${repository.full_name}/languages`)),
);
const languageBytes = languageResults.reduce((totals, result) => {
  for (const [language, bytes] of Object.entries(result)) {
    totals[language] = (totals[language] || 0) + bytes;
  }
  return totals;
}, {});

await mkdir(outputDirectory, { recursive: true });
await Promise.all([
  writeFile(`${outputDirectory}/github-stats.svg`, statsCard(profile, repositories)),
  writeFile(`${outputDirectory}/top-languages.svg`, languagesCard(languageBytes)),
]);
console.log(`Generated profile cards from ${repositories.length} public repositories`);
