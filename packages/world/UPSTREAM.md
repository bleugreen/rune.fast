# Upstream provenance

`packages/world` is a port of a world renderer with a long lineage. The BSD-2-Clause licence in `LICENSE` (copyright 2022-2023 dennisdev) applies to the original rs-map-viewer work and is kept with every derivative.

1. **rs-map-viewer** by dennisdev: the WebGL RuneScape cache map viewer this engine began as.
2. **RS World** (https://github.com/MaxBittker/rs-world), at revision `605fac4db3eb9840f24f854db9a22dafd24e9ca6`: rs-map-viewer extended with live entities.
3. **rs-dash**, a local dashboard and world viewer for the rs-sdk demo server, at revision `f9db8afdcdb01bcf871d879bae7c90c60f7c260d`: added the live world-feed layer (`src/live`), the rs-sdk revision 289 cache path and the live entity renderer.
4. **This port**, for rune.fast's recorded replays.

## What this port took

From rs-dash: `src/rs` (the cache engine), `src/mapviewer` (renderer core, WebGL, worker, shaders), `src/live` (the live layer), `src/components/renderer` (now `src/renderer`), `src/picogl` and `src/util`.

## What it left out

The dashboard, server and telemetry; the world map, minimap, menus and loading UI; the NPC spawn data files (one of them, `npc-spawns-2009.json`, is AGPL-3.0); the socket client `WorldFeedClient`; the CRA application shell, Wallpaper Engine hooks and web vitals; the RuneScape TTF fonts and interface images; the dat2 cache loader and its procedural texture generator, which revision 289 never reaches; the minimap image rendering and its Cache Storage; and the on-screen joysticks.

## What it changed

- Built by Vite instead of CRA: native module workers with a small typed RPC replace threads.js, a GLSL include plugin replaces ts-shader-loader, ESM imports replace `require()`, bzip2 is pure JavaScript, and `.web.ts` modules resolve first so the browser decodes gzip with wasm.
- The live layer takes its frames from a `FeedSource` and its cycles from a `WorldStepper`, so a recorded clip drives it as the socket did. `FeedGate` holds the socket client's acceptance rules as a pure function.
- `LiveWorld` and `FarPlayers` snapshot and restore their simulation state, for replay checkpoints.
- `src/replay`: the clip format, the deterministic `Playhead`, the chunk cutter and the browser `ReplayDriver`.
- Settings are a plain `RenderSettings` object instead of a leva panel; the cache is fetched from a configured asset base; overlay text is drawn in IBM Plex Sans.
- The renderer's teardown no longer stops the viewer's live controller.

## Credits

RS World credits rs-sdk and LostCity (MIT), Jagex, RuneLite, OpenRS2 Archive, RuneScape Archive, OSRS Wiki, 2004scape, 2009scape, RuneStar, Blurite and RuneApps Model Viewer.

## Game data

The game cache is not part of this repository. rune.fast serves the rs-sdk revision 289 store, acquired from rs-sdk-demo.fly.dev, from its own asset bucket, subject to upstream data rights. Recorded world-feed clips are redacted before publication: every player name except the record account's becomes its slot number, and player chat is removed.
