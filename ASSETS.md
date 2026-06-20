# Assets

Hermes: Godspeed ships with local image and audio assets under `assets/`. Source code is MIT licensed; bundled artwork and narration are documented separately here.

## Release Status

The project owner approved the bundled local artwork for the June 3, 2026 public release pass. No third-party attribution requirements are recorded in this repository. If any image is replaced or traced to an external source with additional restrictions, update this file before publishing another release.

## Shipped Artwork

| Files | Purpose | Source/provenance | Public redistribution status |
| --- | --- | --- | --- |
| `assets/characters/hermes-runner-source.png` | Full-size Hermes source artwork | Project-local source artwork | Approved for this release |
| `assets/characters/hermes-runner.png` | Full-size Hermes export | Derived from project-local source artwork | Approved for this release |
| `assets/characters/hermes-runner-trimmed.png` | Trimmed Hermes intermediate | Derived from project-local source artwork | Approved for this release |
| `assets/characters/hermes-runner-game.png` | Optimized in-game Hermes sprite | Derived from project-local source artwork | Approved for this release |
| `assets/characters/hermes-run-strip.png` | Four-frame Hermes run-cycle spritesheet | Project-local AI-generated animation pass based on the approved Hermes artwork | Approved for this release |
| `assets/characters/hermes-run/*.png` | Normalized source frames for the run-cycle spritesheet | Derived from the project-local AI-generated animation grid | Approved for this release |
| `assets/characters/hermes-run-preview.png` | Run-cycle review contact sheet | Derived from the normalized run-cycle frames | Approved for this release |
| `assets/enemies/openclaw-lobster-source.png` | Full-size OpenClaw source artwork | Project-local source artwork | Approved for this release |
| `assets/enemies/openclaw-lobster.png` | Full-size OpenClaw export | Derived from project-local source artwork | Approved for this release |
| `assets/enemies/openclaw-lobster-trimmed.png` | Trimmed OpenClaw intermediate | Derived from project-local source artwork | Approved for this release |
| `assets/enemies/openclaw-lobster-game.png` | Optimized in-game OpenClaw sprite | Derived from project-local source artwork | Approved for this release |
| `assets/obstacles/myth-tech-barricade.png` | Low ground hazard sprite | Project-local AI-generated artwork created for the collision-readability pass | Approved for this release |
| `assets/obstacles/myth-tech-zapbar.png` | Overhead lightning hazard sprite | Project-local AI-generated artwork created for the collision-readability pass | Approved for this release |
| `assets/powerups/chomp-relic.png` | Divine Chomp power-up sprite | Project-local AI-generated artwork created for the collision-readability pass | Approved for this release |
| `assets/powerups/sandals-relic.png` | Winged Sandals power-up sprite | Project-local AI-generated artwork created for the collision-readability pass | Approved for this release |
| `assets/powerups/goblet-relic.png` | Golden Goblet power-up sprite | Project-local AI-generated artwork created for the collision-readability pass | Approved for this release |
| `assets/powerups/bolt-relic.png` | Zeus Bolt power-up sprite | Project-local AI-generated artwork created for the collision-readability pass | Approved for this release |
| `assets/powerups/magnet-relic.png` | Lobster Magnet power-up sprite | Project-local AI-generated artwork created for the collision-readability pass | Approved for this release |
| `assets/environment/myth-tech-roadway.png` | Full-size roadway artwork | Project-local source artwork | Approved for this release |
| `assets/environment/myth-tech-roadway-game.jpg` | Optimized in-game roadway background | Derived from project-local source artwork | Approved for this release |
| `assets/cutscene/intro-olympus-signal.jpg` | Intro cutscene still | Project-local AI-generated still | Approved for this release |
| `assets/cutscene/intro-openclaw-surge.jpg` | Intro cutscene still | Project-local AI-generated still | Approved for this release |
| `assets/cutscene/intro-hermes-launch.jpg` | Intro cutscene still | Project-local AI-generated still | Approved for this release |
| `assets/cutscene/intro-godspeed-run.jpg` | Intro cutscene still | Project-local AI-generated still | Approved for this release |
| `assets/cutscene/intro-title-backdrop.jpg` | Intro cutscene still | Project-local AI-generated still | Approved for this release |
| `assets/cutscene/intro-narration.mp3` | Intro cutscene narration | Generated with the dev-only Kokoro TTS workflow from project-local copy | Approved for this release |
| `public/favicon.svg` | Browser tab icon and web app manifest icon | Original vector created for this release pass | MIT with source code |
| `docs/screenshots/hermes-godspeed-gameplay.png` | README hero screenshot | Deterministic Playwright capture of the current local game title screen | Approved for this release |

## Trailer Media

The canonical trailer source is tracked under `trailer/`, but its generated inputs and output are not. `trailer/scripts/sync-assets.mjs` copies approved repository artwork into the ignored `trailer/public/generated/` directory at render time, keeping the root `assets/` directory as the single source of truth.

The trailer score is generated locally by `trailer/scripts/generate-score.mjs` from project-authored synthesis code. It contains no sampled or third-party music. Generated gameplay captures come from the current local game build through Playwright, and the final MP4 is written to the ignored `trailer/out/` directory.

## Build Notes

The optimized game assets are referenced from `src/assets/manifest.ts` with static Vite asset URLs. A production build must emit the image and audio files into `dist/assets/`; if it does not, release QA should fail because Phaser will log image processing errors, render missing-texture placeholders, or fail the intro narration request.

The `npm run voice:intro` command uses Kokoro as a local development-time generator. The released game does not ship Kokoro model files and does not call a TTS API at runtime.
