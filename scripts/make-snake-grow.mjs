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

const claudeCodeScene = `<defs>
<linearGradient id="claude-bg" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#faf7f2"/><stop offset="1" stop-color="#eee6dc"/></linearGradient>
<pattern id="paper-grid" width="32" height="32" patternUnits="userSpaceOnUse"><path d="M32 0H0v32" fill="none" stroke="#8f8177" stroke-width=".45" opacity=".1"/></pattern>
<filter id="soft-shadow" x="-20%" y="-30%" width="140%" height="170%"><feDropShadow dx="0" dy="1" stdDeviation="1.3" flood-color="#5d5149" flood-opacity=".18"/></filter>
</defs>
<rect x="-15" y="-31" width="878" height="190" rx="12" fill="url(#claude-bg)" stroke="#b9aa9e" stroke-width="1.5" filter="url(#soft-shadow)"/>
<path d="M-15 -10h878" stroke="#cdbfb4"/>
<text x="92" y="-17" fill="#6f6259" font-family="ui-monospace,SFMono-Regular,Consolas,monospace" font-size="7">~/contributions — claude</text>
<rect x="-8" y="-7" width="852" height="119" rx="7" fill="#f6f1ea" stroke="#d3c7bd"/>
<rect x="-8" y="-7" width="852" height="119" rx="7" fill="url(#paper-grid)"/>
<path d="M-7 127h850" stroke="#cdbfb4"/><rect x="-7" y="132" width="850" height="19" rx="5" fill="#e6ddd3"/>
<text x="5" y="145" fill="#5d5149" font-family="ui-monospace,SFMono-Regular,Consolas,monospace" font-size="7"><tspan fill="#d97757">❯</tspan> claude --trace-contributions <tspan fill="#8b7d73">· growing with every commit</tspan></text>
<g aria-label="snake start prompt"><rect x="-7" y="-29" width="29" height="17" rx="5" fill="#2f2a27"/><text x="0" y="-17" fill="#f6f1ea" font-family="ui-monospace,SFMono-Regular,Consolas,monospace" font-size="10" font-weight="700">❯_</text></g>
<g aria-label="snake return prompt"><rect x="49" y="-29" width="31" height="17" rx="5" fill="#d97757"/><text x="57" y="-17" fill="#fffaf5" font-family="ui-monospace,SFMono-Regular,Consolas,monospace" font-size="10" font-weight="700">✓</text></g>`;

const growingSvg = svg
  .replace(/<svg\b[^>]*>/, (openingTag) => {
    return `${openingTag}<rect x="-100%" y="-100%" width="300%" height="300%" fill="#f4eee7"/>${claudeCodeScene}`;
  })
  .replace("</style>", `${growthStyles}</style>`)
  .replace("</svg>", `${growthSegments}</svg>`);

await writeFile(svgPath, growingSvg);
console.log(`Added ${eatenAt.length} growing snake segments`);
