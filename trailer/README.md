# Hermes: Godspeed Launch Trailer

This directory is the canonical editable source for the official 45-second launch trailer. It combines a Remotion composition with deterministic Playwright captures of the current game. Generated captures, copied assets, audio, stills, and rendered videos are intentionally ignored by Git.

## Requirements

- Node.js 18 or newer
- The game dependencies installed at the repository root
- FFmpeg and FFprobe available on `PATH`
- Playwright Chromium installed (`npx playwright install chromium` if needed)

Install the trailer dependencies once:

```bash
npm --prefix trailer ci
```

## Canonical render

From the repository root:

```bash
npm run trailer:render
```

That command performs the complete reproducible pipeline:

1. Sync current repository artwork into `trailer/public/generated/assets/`.
2. Generate the project-local procedural score.
3. Capture deterministic current gameplay and feature UI footage with Playwright.
4. Refresh `docs/screenshots/hermes-godspeed-gameplay.png` from the same current game build.
5. Typecheck and lint the Remotion source.
6. Render and verify the final H.264/AAC MP4.

Final output:

```text
trailer/out/hermes-godspeed-launch-trailer.mp4
```

The output remains local and ignored. Do not commit it.

## Useful commands

```bash
npm run trailer:preview
npm run trailer:capture
npm --prefix trailer run sync-assets
npm --prefix trailer run score
npm --prefix trailer run lint
npm --prefix trailer run render
```

`trailer:preview` opens Remotion Studio. Preview and render require generated assets, score, and capture inputs; run `npm run trailer:render` once after a clean checkout, or run the individual generation commands first.

## Source and generated files

Durable source lives in `src/`, `scripts/`, the package/config files, and this documentation. `public/generated/` and `out/` are disposable. The game artwork under the repository-level `assets/` directory remains the single source of truth.

The browser capture script first tries the installed Chrome channel and automatically falls back to Playwright's bundled Chromium. It uses only the game's existing test-mode events and never modifies production gameplay behavior.

See [STORYBOARD.md](STORYBOARD.md) for timing and editorial intent.
