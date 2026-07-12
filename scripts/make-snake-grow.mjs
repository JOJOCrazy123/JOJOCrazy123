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
const headPercentages = [...headAnimationMatch[0].matchAll(/([\d.]+)%/g)].map(
  ([, percentage]) => Number(percentage),
);
const firstStepPercentage = Math.min(
  ...headPercentages.filter((percentage) => percentage > 0),
);
const stepDuration = Math.max(
  1,
  Math.round((duration * firstStepPercentage) / 100),
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

const growingSvg = svg
  .replace("</style>", `${growthStyles}</style>`)
  .replace("</svg>", `${growthSegments}</svg>`);

await writeFile(svgPath, growingSvg);
console.log(`Added ${eatenAt.length} growing snake segments`);
