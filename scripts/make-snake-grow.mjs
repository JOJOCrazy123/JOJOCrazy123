import { readFile, writeFile } from "node:fs/promises";

const svgPath = process.argv[2];

if (!svgPath) {
  throw new Error("Usage: node scripts/make-snake-grow.mjs <snake.svg>");
}

const svg = await readFile(svgPath, "utf8");
const durationMatch = svg.match(/animation:none (\d+)ms linear infinite/);
const headAnimationMatch = svg.match(/@keyframes s0\{([^}]|}(?!\.s\.s0))+/);
const headRectMatch = svg.match(/<rect class="s s0" ([^>]+)\/>/);

if (!durationMatch || !headAnimationMatch || !headRectMatch) {
  throw new Error("The generated SVG does not match the expected Platane/snk structure");
}

const duration = Number(durationMatch[1]);
const headPercentages = [
  ...new Set(
    [...headAnimationMatch[0].matchAll(/([\d.]+)%/g)].map(([, percentage]) =>
      Number(percentage),
    ),
  ),
].sort((a, b) => a - b);
const stepPercentages = headPercentages
  .slice(1)
  .map((percentage, index) => percentage - headPercentages[index])
  .filter((percentage) => percentage > 0.01);
const stepPercentage = Math.min(...stepPercentages);

if (!Number.isFinite(stepPercentage)) {
  throw new Error("Could not determine the snake movement step duration");
}

// The first non-zero keyframe is not necessarily one movement step: the head
// can remain off-grid for several steps. Use the smallest keyframe interval.
// snk rounds percentages to two decimals, so restore the millisecond value to
// the nearest 10 ms to avoid accumulating that rounding error along the body.
const stepDuration = Math.max(
  1,
  Math.round(((duration * stepPercentage) / 100) / 10) * 10,
);

const eatenAt = [...svg.matchAll(/@keyframes c\d+\{[^}]+}\s*([\d.]+)%/g)]
  .map(([, percentage]) => Number(percentage))
  .sort((a, b) => a - b);

if (eatenAt.length === 0) {
  console.log("No contribution cells to grow from");
  process.exit(0);
}

const tailAttributes = headRectMatch[1]
  .replace(/x="[^"]+"/, 'x="3.0"')
  .replace(/y="[^"]+"/, 'y="3.0"')
  .replace(/width="[^"]+"/, 'width="9.9"')
  .replace(/height="[^"]+"/, 'height="9.9"')
  .replace(/rx="[^"]+"/, 'rx="3.3"')
  .replace(/ry="[^"]+"/, 'ry="3.3"');

const growthStyles = [
  `.g{animation:none ${duration}ms linear infinite}`,
  ...eatenAt.map((percentage, index) => {
    const revealAt = Math.min(99.98, percentage + 0.01);
    return `@keyframes g${index}{0%,${percentage}%{opacity:0}${revealAt}%,99.99%{opacity:1}100%{opacity:0}}.g.g${index}{animation-name:g${index}}`;
  }),
].join("");

const growthSegments = eatenAt
  .map((_, index) => {
    const movementDelay = (4 + index) * stepDuration;
    return `<g class="g g${index}"><rect class="s s0" ${tailAttributes} style="animation-delay:${movementDelay}ms"/></g>`;
  })
  .join("");

const forestScene = `<defs>
<linearGradient id="forest-bg" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#f4fbf1"/><stop offset="1" stop-color="#e5f4df"/></linearGradient>
<pattern id="forest-leaves" width="48" height="16" patternUnits="userSpaceOnUse"><circle cx="8" cy="9" r="5" fill="#86c76f"/><circle cx="15" cy="6" r="6" fill="#5eae58"/><circle cx="23" cy="10" r="5" fill="#3f9149"/><path d="M15 11v5" stroke="#7b5a3a" stroke-width="2"/></pattern>
<filter id="forest-shadow" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="1" stdDeviation="1" flood-color="#214d2d" flood-opacity=".25"/></filter>
</defs>
<rect x="-15" y="-31" width="878" height="190" rx="14" fill="url(#forest-bg)" stroke="#397847" stroke-width="2"/>
<rect x="-8" y="-9" width="852" height="120" rx="10" fill="#ffffff" fill-opacity=".72" stroke="#9ac78f" stroke-dasharray="3 4"/>
<path d="M-5 122H845" stroke="#bbd8a7" stroke-width="18" stroke-linecap="round" opacity=".55"/>
<path d="M-5 122H845" stroke="url(#forest-leaves)" stroke-width="12" stroke-dasharray="2 10" opacity=".9"/>
<g fill="url(#forest-leaves)"><rect x="-8" y="-27" width="852" height="12"/><rect x="-8" y="144" width="852" height="12"/></g>
<g filter="url(#forest-shadow)" aria-label="snake start">
  <path d="M-8 -13L8 -27l16 14v13H-8z" fill="#d99a52" stroke="#6d4528"/><path d="M-11 -13L8 -30l19 17" fill="none" stroke="#3f7f48" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/><rect x="3" y="-10" width="9" height="10" rx="2" fill="#714326"/><circle cx="9" cy="-5" r="1" fill="#f6d365"/>
</g>
<g filter="url(#forest-shadow)" aria-label="snake home">
  <path d="M47 -13l17 -14 17 14V0H47z" fill="#efb65d" stroke="#6d4528"/><path d="M44 -13l20 -17 20 17" fill="none" stroke="#397847" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/><rect x="59" y="-10" width="10" height="10" rx="5" fill="#714326"/><path d="M73 -22v-7h6v12" fill="#a85b43" stroke="#6d4528"/>
</g>`;

const growingSvg = svg
  .replace(/<svg\b[^>]*>/, (openingTag) => {
    return `${openingTag}<rect x="-100%" y="-100%" width="300%" height="300%" fill="#fbfdf8"/>${forestScene}`;
  })
  .replace("</style>", `${growthStyles}</style>`)
  .replace("</svg>", `${growthSegments}</svg>`);

await writeFile(svgPath, growingSvg);
console.log(`Added ${eatenAt.length} growing snake segments`);
