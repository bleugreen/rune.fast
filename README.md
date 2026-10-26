# rune.fast

The public record of an AI agent swarm that took a fresh account to 99 in all 19 skills on the 2004scape demo server in 35,787 logged-in ticks (3 h 58 min 34 s at 400 ms a tick), 129 ticks under the previous record of 35,916. The account reached #1 on 26 October 2026.

## Running it

```sh
bun install
bun run dev        # http://localhost:5173, including the /tokens design screen
bun run check      # typecheck, tests, production build, and the public-identifier scan of dist/
```

`bun run build` writes the static site to `dist/`. The `/tokens` route renders the palette, type scale, figures and a sample chart; it exists only under `bun run dev`.

## How it is built

Vite, React 18 and TypeScript, with client-side routes from react-router and charts drawn as SVG from d3-scale, d3-array and d3-time. There is no UI kit and no CSS framework: every colour, face, size and space is a custom property in `src/styles/tokens.css`, and components style themselves with CSS modules.

The data lives in `data/` as the documenting agent exported it. `data/attempts-timeline.json` is checked in verbatim, including names the site must not publish. The build never ships that file as is: `vite.config.ts` replaces the import with the projection in `scripts/public-timeline.ts`, which keeps only the fields the pages render and redacts those identifiers, and `bun run check:public` fails the check if any of them reaches `dist/`: fleet helper and lab account names, private host names (the `rs-ashburn` and `bgsrv` machines, `.ts.net` and `.local` addresses), game-process tokens, home-directory paths, message id fields, the swarm's `cairn://` addresses and IPv4 addresses. The data files keep those addresses as the project's traceability; every page prints a source as plain-words provenance instead (who, where, when in Pacific time), through the one address table in `src/lib/places.ts`. The timeline projection does this for each event's sources, `scripts/public-tricks.ts` for the tricks cards, both by way of `scripts/plain-source.ts`, which throws on any address or UTC time it cannot put in plain words. Place names are not host names: the story says the run host sat in Ashburn, Virginia, which is public (the demo runs in Fly's iad region). Rival players may be named for public leaderboard facts, their ranks and times, so the previous record holder appears on the story page; the timeline projection still drops the name along with the rest of the archival fields.

The cost page (`/cost`) reads the cost exports beside it: `summary.json`, `cost-data.json`, `roles.json` and `hourly.json` from the documenting agent's cost refresh, `billing.json` (the list-price table that refresh priced with, and the subscriptions the swarm ran on: six Claude Max plans by the end of the run and one ChatGPT Pro plan, $200 a month each), `swarm-events.json` (spawns, merges and messages per Pacific calendar day from the thread's event graph) and `swarm-activity.json` (agents producing output: distinct runs with at least one model-output event in each five-minute bucket, so warm idle sessions are not counted). Every dollar figure on that page is the list-price value of tokens, not money paid; the page says so once and compares it with the subscriptions, $1,400 a month prorated over the window by the average month, about $256. Times and days on the page are Pacific, and the page states the zone once. `cost-data.json` also holds a turn-concurrency curve the page no longer draws, because warm idle sessions hold turns open and inflate it. `cost-data.json` and `roles.json` carry issue titles and unit names that name helper accounts and run hosts, so `scripts/public-cost.ts` projects them to the numeric fields the page draws, through the same Vite plugin as the timeline. `src/cost/model.ts` derives every figure the page writes, and `src/cost/model.test.ts` checks the exports against each other (the price table reproduces each model's and each Pacific day's cost from the hourly tokens), pins the page's claims, and fails if any number in the page's text is not one the model derived from the data.

The story on `/` is the documenting agent's draft, placed verbatim. `data/story.md` is a byte-for-byte copy of it and `data/receipts/section-N.md` of its per-section dig files, both refreshed with `bun scripts/import-story.ts [path]`, which refuses a draft that no longer parses or no longer contains what the page anchors to it. `src/story/draft.ts` splits the draft into the title, the byline, six sections of paragraphs and quoted messages, and each section's sources; it never edits a character of the prose, and renders only two inline marks, `code` spans and *emphasis*. A section's sources are its key anchors from the draft's Receipts plus the source table of its dig file, and `src/story/sources.ts` puts them in plain words for the page (who, where, when, with addresses through the site's shared table in `src/lib/places.ts`): the files keep their cairn:// addresses, transcript turns and raw sequence numbers as the project's traceability, and the page prints none of them. The build and the tests load the draft through `scripts/story-module.ts`, so only the page copy and the plain sources reach the bundle and the draft's editorial header does not. What the page adds to each section (its anchor, dates, the one figure and the block it follows, the operator's short lines set again as margin quotes, the one outbound link) lives in `src/story/sections.ts`, and `src/story/story.test.tsx` renders the page and fails unless every paragraph of `data/story.md` is on it as a reader sees it (byte for byte, less the code and emphasis delimiters), the sources sit only inside the closed Sources disclosures and carry no cairn:// address, and every margin quote is the prose's own words.

The attempts chart draws each scored account's logged-in spans from a table in `src/attempts/model.ts`. Every span bound points at an event in the JSON, or at a clock time an event's text states, and the tests in `src/attempts/model.test.ts` fail if a bound no longer matches the data. The page's headline counts (attempts, hours, stops, deaths) are computed from the same model.

The tricks page reads `data/tricks.json`, written by hand from the documenting agent's evidence inventory: one object per technique, with what the game normally does, what the run did instead, why the server allows it, the run steps in plain words, and at most one before-and-after saving. A saving records its basis (measured, inferred or estimated), and a technique the sources never measured has no saving, so its card claims none. Sources stay in the JSON with the swarm's addresses and appear only behind each card's closed `sources` disclosure, in plain words: the build replaces the file with `scripts/public-tricks.ts`'s projection, which prints `issue rs/47 (the wine route, merged)` for `cairn://p/rs/47 (…)`, names the rs-sdk fork for its paths, and turns UTC times into Pacific. `src/tricks/model.ts` groups the techniques, orders each group by the share of cost a measured trick removes, and computes the page's headline; `src/tricks/model.test.ts` checks every chart has numeric figures and a basis, that no card text carries a bare run-step code, and the rulings on individual figures (the whole-run knife saving is inferred; Charge is published as its measured rate). A card names its clip by id; a card without one shows a one-line slot.

## Clips

Every game clip on the site is registered in `data/clips.json` (its file and poster under `public/clips/`, frame size, length, caption, time, run step and source in plain words) and drawn by the one `Clip` component in `src/clips/`: the poster with a single play mark, a hairline progress rule in the accent while it plays, and, for a lab clip, the server tick on screen, read from the `ticks` map the registry copies out of the lab trace. It never autoplays, loops or plays sound, and returns to the poster at the end. Clips run 10 to 15 seconds and stay under 3 MB; `src/clips/registry.test.ts` checks every entry against its files (the MP4's frame size and length, the poster's size) and that every clip is placed on a page. The finish-recording cuts follow RUNE tenet #4: cropped to the game canvas, never the login box, and timed from the SDK log stamps on screen, which run 4 s after the recording's nominal file offset. The story places clips as figures in `src/story/sections.ts`, which lets a section carry more than one figure.

## Replays

`/replay/finish` replays the last 41 minutes of the record (26 October, 10:27 to 11:08 UTC: the recovery login at Lumbridge to Agility 99 on the Wilderness course) in the game world, from the swarm's recording of the demo server's world feed. The route is lazy: the engine loads only there.

**The engine** is `packages/world` (`@rune/world`), rs-dash's world renderer and live layer, which descend from dennisdev's rs-map-viewer through RS World; `packages/world/UPSTREAM.md` gives the lineage and what the port kept, dropped and changed, and `LICENSE` is its BSD-2-Clause licence. Both are published at `/licenses/` and linked from the footer. The package has its own tsconfig (strict, without the site's `noUncheckedIndexedAccess`, which upstream code was never written for) and the root typechecks it through a project reference with `tsc -b`. `packages/world/vite.ts` holds what the build needs: `.web.ts` modules ahead of their headless twins (so the browser decodes gzip with wasm), GLSL `#include` expansion, ES module workers, the licence files, and cross-origin isolation headers for dev and preview. `public/_headers` sets the same COOP and COEP site-wide on Pages, because the worker pool shares the cache through `SharedArrayBuffer` and a client-side navigation never re-fetches the document.

**Playback.** The live layer takes frames from a `FeedSource` and its cycles from a `WorldStepper`. On the live site that was a socket; here `ReplayDriver` (`src/replay`) is both. A frame received `recv` ms after its epoch's hello is applied at client cycle `floor((recv - helloRecv) / 20)`, before that cycle runs, through `FeedGate`, the socket client's acceptance rules as a pure function. The simulation has no clocks or randomness, so a clip played straight through and one restored from a checkpoint end in the same state; `packages/world/test/replay.test.ts` holds that at every tick of the fixture. The world only applies deltas, so seeking needs a full state to start from: `LiveWorld.snapshot()` and `restore()` carry it as JSON, with entities in Map order, because the order they are cycled in is itself state. Each chunk starts with a checkpoint, and the driver keeps one every 50 ticks while it plays. On an hour of the recording, a backward seek from the segment start took a median 6.5 s (p95 11.5 s); from the nearest 50-tick checkpoint, a median 9 ms (p95 90 ms) (`scripts/world/bench-seek.ts`).

**Publishing a clip** runs on the operator's Mac, where the recordings and the cache are:

```sh
bun scripts/world/sync-local.ts <rs-dash>/caches     # the cache store into .world/cache/
RUNE_SCORED_ACCOUNT="$(cat <recorder>/follow)" bun scripts/world/publish-clip.ts \
  --clip finish --from 2026-10-26T10:27:00Z --to 2026-10-26T11:08:00Z \
  --recordings <recorder>/out [--upload] [--upload-cache]
bun scripts/world/shoot.ts --base http://localhost:4173   # screenshots, against vite preview
```

`publish-clip` chains the recorder's hourly files from the last hello before the window, gates every frame, redacts it, simulates headless with the real cache loaders up to the window, and writes one-minute chunks, each led by its checkpoint, brotli-compressed and named by content hash, plus `manifest.json` (chunk table, the timeline anchor, the account's out-of-view stretches) into `.world/replays/<clip>/`. The manifest's chunk table is the seek index: byte offsets would not be addressable inside brotli-encoded objects. It checks that Agility 99 lands on session tick 6095 within 100 ms of the timeline's time. `.world/` is gitignored and never under `public/`; dev and preview serve it at `/world-assets/`, as the bucket serves `world/`.

**Redaction** (`scripts/world/redact.ts`) happens to every frame before it is simulated, so checkpoints inherit it. The scored account's name comes only from the environment, and the script fails closed without it, or if the account holds no roster slot or more than one in the window. Every other player's name, in rosters and inside appearance blocks, becomes its slot (`slot_1167`, shown as Slot 1167); players' chat and overhead text are dropped; NPC text that names any player is dropped. Before anything is written for upload, the script scans every byte it wrote, by whole words and blind to case and separators, for every name it saw, decodes every appearance block, and applies the same forbidden-identifier list as `check:public` (`scripts/forbidden.ts`); one hit deletes the output. Its report carries counts and slots, never names. For the finish clip it replaced 8,377,034 roster names and 24,882 appearance names, dropped 148 player texts, scanned for 1,700 names and found none. `scripts/world/redact.test.ts` holds the same property on the fixture, whose names are all fictional.

**Hosting.** Production reads `VITE_WORLD_ASSET_BASE` from `.env.production`: the R2 bucket `rune-fast-assets` behind `assets.mage.md`.

```
https://assets.mage.md/world/cache/caches.json
https://assets.mage.md/world/cache/rs-sdk-289-a459e78d81dbd2dc/{main_file_cache.dat, main_file_cache.idx0..4, keys.json, info.json}
https://assets.mage.md/world/replays/finish/manifest.json                (max-age 300)
https://assets.mage.md/world/replays/finish/chunk-NNN.<sha8>.jsonl       (Content-Encoding: br, immutable)
```

The bucket is set up in the Cloudflare dashboard: the custom domain; a CORS policy allowing GET and HEAD from `https://rune.fast`, `https://*.rune-fast.pages.dev`, `http://localhost:5173` and `http://localhost:4173`, with AllowedHeaders `Range` and ExposeHeaders `Content-Length`, `Content-Range` and `ETag`; a response-header Transform Rule on the domain setting `Cross-Origin-Resource-Policy: cross-origin` (R2 object metadata cannot carry it, and the site's COEP needs it); and an API token with Object Read & Write on that bucket only, given to `--upload` as `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` and `R2_BUCKET`. The cache store comes only from rs-sdk-demo.fly.dev, through rs-dash's `sync-cache`; `keys.json` is copied and uploaded as a file and never read.

## Fonts

Self-hosted under `public/fonts/`, both under the SIL Open Font License 1.1 (licences and `FONTLOG.txt` alongside):

- **Rune Serif**, a Latin subset of Source Serif 4 (Adobe, variable weight and optical size). The licence reserves the name "Source" for unmodified fonts, so the subset carries its own name.
- **IBM Plex Sans**, IBM's own unmodified Latin1 files at weights 400, 500 and 600.

## Deploying

Cloudflare Pages builds the site from `main`. The project is configured in the Cloudflare dashboard, not in this repository, so there is no `wrangler.toml`:

- Build command: `bun run build`
- Build output directory: `dist`
- No `404.html` is emitted, so Pages serves `index.html` for unknown paths and the client router handles `/attempts` and the rest.
