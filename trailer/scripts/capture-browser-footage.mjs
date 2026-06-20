import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, rm, rename, writeFile } from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const trailerRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.resolve(trailerRoot, "..");
const generatedRoot = path.join(trailerRoot, "public", "generated");
const mediaDir = path.join(generatedRoot, "media");
const rawDir = path.join(generatedRoot, "raw");
const screenshotPath = path.join(repoRoot, "docs", "screenshots", "hermes-godspeed-gameplay.png");
const viewport = { width: 1920, height: 1080 };
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const run = (command, args, options = {}) =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd ?? repoRoot,
      env: options.env ?? process.env,
      shell: false,
    });
    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (chunk) => {
      stdout += chunk.toString();
      if (options.echo) process.stdout.write(chunk);
    });
    child.stderr?.on("data", (chunk) => {
      stderr += chunk.toString();
      if (options.echo) process.stderr.write(chunk);
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(`${command} ${args.join(" ")} failed with ${code}\n${stderr || stdout}`));
    });
  });

const runNpx = (args, options = {}) =>
  process.platform === "win32"
    ? run("cmd.exe", ["/c", "npx", ...args], options)
    : run("npx", args, options);

const findFreePort = (startPort) =>
  new Promise((resolve) => {
    const tryPort = (port) => {
      const server = net.createServer();
      server.once("error", () => tryPort(port + 1));
      server.once("listening", () => server.close(() => resolve(port)));
      server.listen(port, "127.0.0.1");
    };
    tryPort(startPort);
  });

const waitForServer = async (url, timeoutMs = 60000) => {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // Vite is still starting.
    }
    await wait(350);
  }
  throw new Error(`Timed out waiting for ${url}`);
};

const stopServer = async (server) => {
  if (!server || server.exitCode !== null) return;
  if (process.platform === "win32" && server.pid) {
    await run("taskkill.exe", ["/pid", String(server.pid), "/t", "/f"]).catch(() => undefined);
  } else {
    server.kill("SIGTERM");
  }
};

const launchBrowser = async () => {
  const requestedChannel = process.env.TRAILER_BROWSER_CHANNEL;
  if (requestedChannel) {
    return chromium.launch({ channel: requestedChannel, headless: true });
  }
  try {
    return await chromium.launch({ channel: "chrome", headless: true });
  } catch {
    console.log("Chrome channel unavailable; using Playwright bundled Chromium.");
    return chromium.launch({ headless: true });
  }
};

const profile = {
  version: 2,
  laurels: 42,
  courierSeals: 9,
  introWatched: true,
  stats: {
    totalRuns: 18,
    totalScore: 128400,
    totalLobsters: 386,
    bestCombo: 21,
    topSpeed: 842,
    longestRunMs: 78200,
    obstaclesSmashed: 44,
    powerupsCollected: 61,
    courierSeals: 9,
    dailyRuns: 6,
  },
  missions: [
    { id: "lobsters-40", value: 31 },
    { id: "powerups-3", value: 2 },
    { id: "combo-12", value: 9 },
  ],
  unlockedCosmetics: [
    "trail-aether",
    "trail-sunfire",
    "trail-rose",
    "trail-verdant",
    "trail-storm",
    "trail-neon",
    "title-winged",
    "title-laurel",
    "title-chompion",
    "title-godspeed",
    "title-herald",
    "title-openclaw",
    "theme-trt-noir",
    "theme-divine",
    "theme-sunrise",
    "theme-ember",
    "theme-undercloud",
  ],
  loadout: { trail: "trail-sunfire", title: "title-godspeed", theme: "theme-divine" },
  dailyBests: {},
  ghosts: [],
};

const preparePage = async (page) => {
  await page.addInitScript((seedProfile) => {
    window.localStorage.setItem("hermes-godspeed.profile.v1", JSON.stringify(seedProfile));
    window.localStorage.setItem(
      "hermes-godspeed.settings.v1",
      JSON.stringify({ music: false, sfx: false, reducedMotion: false, difficulty: "godspeed" }),
    );
    window.localStorage.setItem(
      "hermes-godspeed.highScores.v2",
      JSON.stringify({
        easy: { score: 0, lobsters: 0, achievedAt: "" },
        normal: { score: 18420, lobsters: 74, achievedAt: "2026-06-20T00:00:00.000Z" },
        hard: { score: 12680, lobsters: 51, achievedAt: "2026-06-20T00:00:00.000Z" },
        godspeed: { score: 9320, lobsters: 38, achievedAt: "2026-06-20T00:00:00.000Z" },
      }),
    );
  }, profile);
};

const dispatchAction = async (page, action, pressed = true) =>
  page.evaluate(
    ({ name, active }) => window.dispatchEvent(new CustomEvent("ui:action", { detail: { action: name, pressed: active } })),
    { name: action, active: pressed },
  );

const pulseAction = async (page, action, holdMs = 160) => {
  await dispatchAction(page, action, true);
  await wait(holdMs);
  await dispatchAction(page, action, false);
};

const spawnEntity = async (page, detail) =>
  page.evaluate((value) => window.dispatchEvent(new CustomEvent("test:spawnEntity", { detail: value })), detail);

const activatePower = async (page, power) =>
  page.evaluate((value) => window.dispatchEvent(new CustomEvent("test:activatePower", { detail: { power: value } })), power);

const activateBoon = async (page, boon) =>
  page.evaluate(
    (value) =>
      window.dispatchEvent(
        new CustomEvent("test:activatePower", { detail: { boon: { kind: value, label: "Storm Shield" } } }),
      ),
    boon,
  );

const forceGameOver = async (page) =>
  page.evaluate(() => window.dispatchEvent(new CustomEvent("test:forceGameOver")));

const startRun = async (page) => {
  await page.locator("#startButton").waitFor({ state: "visible", timeout: 20000 });
  await wait(900);
  await page.locator("#startButton").click();
  await page.waitForFunction(() => document.body.dataset.phase === "playing", { timeout: 20000 });
};

const showcaseAction = async (page) => {
  await startRun(page);
  await activateBoon(page, "storm-shield");
  await wait(550);
  await spawnEntity(page, { kind: "lobster", lane: 1, offsetX: 360 });
  await spawnEntity(page, { kind: "obstacle-low", lane: 0, offsetX: 610 });
  await spawnEntity(page, { kind: "powerup", lane: 2, power: "chomp", offsetX: 790 });
  await spawnEntity(page, { kind: "obstacle-high", lane: 2, offsetX: 1020 });
  await wait(360);
  await mkdir(path.dirname(screenshotPath), { recursive: true });
  await page.screenshot({ path: screenshotPath, type: "png" });

  await wait(480);
  await pulseAction(page, "laneLeft");
  await wait(420);
  await pulseAction(page, "jump", 210);
  await wait(920);
  await pulseAction(page, "laneRight");
  await spawnEntity(page, { kind: "golden-lobster", lane: 1, offsetX: 460 });
  await wait(720);
  await spawnEntity(page, { kind: "obstacle-high", lane: 1, offsetX: 520 });
  await pulseAction(page, "slide", 620);
  await wait(900);

  await spawnEntity(page, { kind: "powerup", lane: 1, power: "chomp", offsetX: 430 });
  await wait(600);
  await activatePower(page, "chomp");
  await spawnEntity(page, { kind: "obstacle-low", lane: 1, offsetX: 520 });
  await wait(1250);
  await spawnEntity(page, { kind: "powerup", lane: 2, power: "sandals", offsetX: 480 });
  await pulseAction(page, "laneRight");
  await wait(850);
  await activatePower(page, "sandals");
  await wait(850);

  await spawnEntity(page, { kind: "gate", lane: 1, offsetX: 700 });
  await wait(900);
  await activateBoon(page, "storm-shield");
  await pulseAction(page, "laneLeft");
  await wait(1200);
  await spawnEntity(page, { kind: "powerup", lane: 0, power: "goblet", offsetX: 500 });
  await wait(700);
  await activatePower(page, "goblet");
  await spawnEntity(page, { kind: "lobster", lane: 0, offsetX: 420 });
  await wait(1000);

  await spawnEntity(page, { kind: "powerup", lane: 1, power: "bolt", offsetX: 480 });
  await pulseAction(page, "laneRight");
  await wait(760);
  await activatePower(page, "bolt");
  await spawnEntity(page, { kind: "obstacle-low", lane: 1, offsetX: 500 });
  await spawnEntity(page, { kind: "obstacle-high", lane: 2, offsetX: 760 });
  await wait(1400);

  await spawnEntity(page, { kind: "powerup", lane: 1, power: "magnet", offsetX: 450 });
  await wait(620);
  await activatePower(page, "magnet");
  for (const lane of [0, 1, 2]) {
    await spawnEntity(page, { kind: "lobster", lane, offsetX: 420 + lane * 140 });
  }
  await wait(1800);
  await pulseAction(page, "jump", 220);
  await wait(950);
  await pulseAction(page, "slide", 600);
  await wait(950);
  await spawnEntity(page, { kind: "gate", lane: 1, offsetX: 620 });
  await wait(1600);
  await activateBoon(page, "storm-shield");

  await spawnEntity(page, { kind: "golden-lobster", lane: 2, offsetX: 520 });
  await pulseAction(page, "laneRight");
  await wait(900);
  await spawnEntity(page, { kind: "obstacle-low", lane: 2, offsetX: 500 });
  await pulseAction(page, "jump", 220);
  await wait(1050);
  await spawnEntity(page, { kind: "powerup", lane: 1, power: "bolt", offsetX: 480 });
  await pulseAction(page, "laneLeft");
  await wait(800);
  await activatePower(page, "bolt");
  await wait(900);
  await spawnEntity(page, { kind: "obstacle-high", lane: 1, offsetX: 450 });
  await pulseAction(page, "slide", 600);
  await wait(1100);
  for (const lane of [0, 1, 2]) {
    await spawnEntity(page, { kind: "lobster", lane, offsetX: 430 + lane * 120 });
  }
  await wait(1200);
  await spawnEntity(page, { kind: "gate", lane: 1, offsetX: 600 });
  await wait(1400);
  await activateBoon(page, "storm-shield");
  await spawnEntity(page, { kind: "obstacle-low", lane: 1, offsetX: 250 });
  await wait(700);
  await forceGameOver(page);
  await page.waitForFunction(() => document.body.dataset.phase === "gameover", { timeout: 12000 });
  await wait(1800);
};

const featuresAction = async (page) => {
  await page.locator("#startButton").waitFor({ state: "visible", timeout: 20000 });
  const drawers = page.locator("details.menu-drawer");
  await wait(900);
  await drawers.nth(0).evaluate((element) => {
    element.open = true;
  });
  await wait(2300);
  await drawers.nth(0).evaluate((element) => {
    element.open = false;
  });
  await drawers.nth(1).evaluate((element) => {
    element.open = true;
  });
  await wait(2600);
  await drawers.nth(1).evaluate((element) => {
    element.open = false;
  });
  await drawers.nth(2).evaluate((element) => {
    element.open = true;
  });
  await wait(1700);
};

const installErrorWatch = (page, name) => {
  const errors = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("requestfailed", (request) => errors.push(`${request.url()} ${request.failure()?.errorText ?? ""}`.trim()));
  return () => {
    if (errors.length) throw new Error(`${name} browser errors:\n${errors.join("\n")}`);
  };
};

const recordTake = async ({ browser, name, url, action }) => {
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor: 1,
    colorScheme: "dark",
    reducedMotion: "no-preference",
    recordVideo: { dir: rawDir, size: viewport },
  });
  const page = await context.newPage();
  const assertClean = installErrorWatch(page, name);
  await preparePage(page);
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle").catch(() => undefined);
  const video = page.video();
  if (!video) throw new Error(`Playwright did not create a video recorder for ${name}`);
  await action(page);
  await context.close();
  assertClean();
  const recordedPath = await video.path();
  const rawPath = path.join(rawDir, `${name}.webm`);
  await rm(rawPath, { force: true });
  await rename(recordedPath, rawPath);
  return { name, rawPath };
};

const transcode = async ({ name, rawPath }) => {
  const output = path.join(mediaDir, `${name}.mp4`);
  await rm(output, { force: true });
  await runNpx(
    [
      "remotion",
      "ffmpeg",
      "-y",
      "-i",
      rawPath,
      "-vf",
      "scale=1920:1080",
      "-r",
      "60",
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-crf",
      "18",
      "-pix_fmt",
      "yuv420p",
      "-an",
      output,
    ],
    { cwd: trailerRoot, echo: true },
  );
  if (!existsSync(output)) throw new Error(`Transcode did not create ${output}`);
  return { name, file: path.relative(trailerRoot, output).replaceAll("\\", "/") };
};

const main = async () => {
  await rm(mediaDir, { recursive: true, force: true });
  await rm(rawDir, { recursive: true, force: true });
  await mkdir(mediaDir, { recursive: true });
  await mkdir(rawDir, { recursive: true });

  const port = Number(process.env.TRAILER_GAME_PORT) || (await findFreePort(5187));
  const baseUrl = `http://127.0.0.1:${port}`;
  const server = spawn(
    process.platform === "win32" ? "cmd.exe" : "npm",
    process.platform === "win32"
      ? ["/c", "npm", "run", "dev", "--", "--port", String(port), "--strictPort"]
      : ["run", "dev", "--", "--port", String(port), "--strictPort"],
    { cwd: repoRoot, stdio: ["ignore", "pipe", "pipe"] },
  );
  server.stdout.on("data", (chunk) => process.stdout.write(chunk));
  server.stderr.on("data", (chunk) => process.stderr.write(chunk));

  let browser;
  try {
    await waitForServer(baseUrl);
    browser = await launchBrowser();
    const takes = [
      await recordTake({
        browser,
        name: "showcase",
        url: `${baseUrl}/?skipIntro=1&testMode=1&manualSpawns=1&renderer=webgl`,
        action: showcaseAction,
      }),
      await recordTake({
        browser,
        name: "features",
        url: `${baseUrl}/?skipIntro=1&testMode=1&renderer=webgl`,
        action: featuresAction,
      }),
    ];
    const sources = [];
    for (const take of takes) sources.push(await transcode(take));
    await writeFile(
      path.join(mediaDir, "capture-manifest.json"),
      `${JSON.stringify({ capturedAt: new Date().toISOString(), method: "Playwright deterministic browser capture", dimensions: viewport, outputFps: 60, sources }, null, 2)}\n`,
    );
    console.log(`Captured current gameplay screenshot: ${screenshotPath}`);
  } finally {
    await browser?.close().catch(() => undefined);
    await stopServer(server);
    await rm(rawDir, { recursive: true, force: true });
  }
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
