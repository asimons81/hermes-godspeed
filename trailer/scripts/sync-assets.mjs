import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const trailerRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.resolve(trailerRoot, "..");
const outputRoot = path.join(trailerRoot, "public", "generated", "assets");

const files = [
  "assets/characters/hermes-run-strip.png",
  "assets/characters/hermes-runner-game.png",
  "assets/enemies/openclaw-lobster-game.png",
  "assets/environment/myth-tech-roadway-game.jpg",
  "assets/obstacles/myth-tech-barricade.png",
  "assets/obstacles/myth-tech-zapbar.png",
  "assets/powerups/chomp-relic.png",
  "assets/powerups/sandals-relic.png",
  "assets/powerups/goblet-relic.png",
  "assets/powerups/bolt-relic.png",
  "assets/powerups/magnet-relic.png",
  "assets/cutscene/intro-olympus-signal.jpg",
  "assets/cutscene/intro-openclaw-surge.jpg",
  "assets/cutscene/intro-hermes-launch.jpg",
  "assets/cutscene/intro-godspeed-run.jpg",
  "assets/cutscene/intro-title-backdrop.jpg",
  "public/favicon.svg",
];

const destinationFor = (source) =>
  source.startsWith("assets/") ? source.slice("assets/".length) : "favicon.svg";

await rm(outputRoot, { recursive: true, force: true });

for (const relativeSource of files) {
  const source = path.join(repoRoot, relativeSource);
  const destination = path.join(outputRoot, destinationFor(relativeSource));
  const relativeDestination = path.relative(outputRoot, destination);
  if (relativeDestination.startsWith("..") || path.isAbsolute(relativeDestination)) {
    throw new Error(`Refusing to write outside generated assets: ${destination}`);
  }
  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(destination, await readFile(source));
}

console.log(`Synced ${files.length} current repository assets to ${outputRoot}`);
