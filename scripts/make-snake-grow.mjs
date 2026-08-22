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

const cyberpunkScene = `<defs>
<linearGradient id="cyber-bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#070916"/><stop offset=".55" stop-color="#11122b"/><stop offset="1" stop-color="#190b2e"/></linearGradient>
<linearGradient id="neon-line" x1="0" y1="0" x2="1" y2="0"><stop stop-color="#00f5ff"/><stop offset=".5" stop-color="#7a5cff"/><stop offset="1" stop-color="#ff2bd6"/></linearGradient>
<pattern id="cyber-grid" width="32" height="32" patternUnits="userSpaceOnUse"><path d="M32 0H0v32" fill="none" stroke="#39d9ff" stroke-width=".45" opacity=".16"/><circle cx="0" cy="0" r="1" fill="#ff2bd6" opacity=".45"/></pattern>
<filter id="neon-glow" x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation="2" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
</defs>
<rect x="-15" y="-31" width="878" height="190" rx="12" fill="url(#cyber-bg)" stroke="url(#neon-line)" stroke-width="2"/>
<rect x="-8" y="-9" width="852" height="120" rx="8" fill="#090b19" stroke="#00e5ff" stroke-opacity=".55"/>
<rect x="-8" y="-9" width="852" height="120" rx="8" fill="url(#cyber-grid)"/>
<path d="M-3 118h34v-10h18v10h24V99h12v19h38v-7h20v7h32V91h15v27h44v-13h17v13h35V96h13v22h49v-9h22v9h29v-24h17v24h38v-12h18v12h42v-20h15v20h40v-8h19v8h35v-27h14v27h40v-15h20v15h37" fill="#111832" stroke="#ff2bd6" stroke-width="1" opacity=".9"/>
<path d="M-5 137h850M-5 146h850" stroke="url(#neon-line)" stroke-width="1" opacity=".7"/>
<path d="M120 -22h110l8 8h86M362 -22h148l8 8h96M690 -22h112" fill="none" stroke="#00f5ff" stroke-width="1.2" opacity=".75"/><circle cx="120" cy="-22" r="2" fill="#ff2bd6"/><circle cx="362" cy="-22" r="2" fill="#ff2bd6"/><circle cx="690" cy="-22" r="2" fill="#ff2bd6"/>
<g filter="url(#neon-glow)" aria-label="snake spawn portal"><path d="M-5 0v-15a13 13 0 0 1 26 0V0" fill="none" stroke="#00f5ff" stroke-width="3"/><path d="M0 0v-14a8 8 0 0 1 16 0V0" fill="#00f5ff" fill-opacity=".12" stroke="#ff2bd6" stroke-width="1.5"/><circle cx="8" cy="-14" r="2" fill="#fff"/></g>
<g filter="url(#neon-glow)" aria-label="snake return portal"><path d="M51 0v-15a13 13 0 0 1 26 0V0" fill="none" stroke="#ff2bd6" stroke-width="3"/><path d="M56 0v-14a8 8 0 0 1 16 0V0" fill="#ff2bd6" fill-opacity=".12" stroke="#00f5ff" stroke-width="1.5"/><path d="M61 -14h6m-3-3 3 3-3 3" fill="none" stroke="#fff" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></g>`;

const growingSvg = svg
  .replace(/<svg\b[^>]*>/, (openingTag) => {
    return `${openingTag}<rect x="-100%" y="-100%" width="300%" height="300%" fill="#050611"/>${cyberpunkScene}`;
  })
  .replace("</style>", `${growthStyles}</style>`)
  .replace("</svg>", `${growthSegments}</svg>`);

await writeFile(svgPath, growingSvg);
console.log(`Added ${eatenAt.length} growing snake segments`);
