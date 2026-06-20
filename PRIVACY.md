# Privacy

Hermes: Godspeed is a client-side browser game. The app does not include analytics, ads, accounts, or telemetry.

## Local Data

The game stores progress in the player's browser with `localStorage`:

- `hermes-godspeed.profile.v1` stores missions, laurels, cosmetics, daily bests, and ghost samples.
- `hermes-godspeed.highScore.v1` and `hermes-godspeed.highScores.v2` store local high scores.
- `hermes-godspeed.settings.v1` stores music, sound effects, reduced motion, and difficulty preferences.

This data stays in the player's browser. It is not sent to a server by this app.

## Recording

Optional MP4 recording uses browser APIs to capture the local game canvas when supported. Recordings are generated locally and saved only when the player chooses to save them. The app does not upload recordings.

## Clipboard

The game writes a share summary to the clipboard only when the player presses the copy share button.

## Network

The released static build loads its own HTML, JavaScript, CSS, and bundled image/audio assets. It does not call external APIs, including text-to-speech APIs.
