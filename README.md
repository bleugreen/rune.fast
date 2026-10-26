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

The data lives in `data/` as the documenting agent exported it. `data/attempts-timeline.json` is checked in verbatim, including names the site must not publish. The build never ships that file as is: `vite.config.ts` replaces the import with the projection in `scripts/public-timeline.ts`, which keeps only the fields the pages render and redacts those identifiers, and `bun run check:public` fails the check if any of them reaches `dist/`: fleet helper and lab account names, private host names (the `rs-ashburn` and `bgsrv` machines, `.ts.net` and `.local` addresses), game-process tokens, home-directory paths, message id fields and IPv4 addresses. Place names are not host names: the story says the run host sat in Ashburn, Virginia, which is public (the demo runs in Fly's iad region). Rival players may be named for public leaderboard facts, their ranks and times, so the previous record holder appears on the story page; the timeline projection still drops the name along with the rest of the archival fields.

The cost page (`/cost`) reads the cost exports beside it: `summary.json`, `cost-data.json`, `roles.json` and `hourly.json` from the documenting agent's cost refresh, `billing.json` (the list-price table that refresh priced with, and the subscriptions the swarm ran on) and `swarm-events.json` (spawns, merges and messages per UTC day from the thread's event graph). Every dollar figure on that page is the list-price value of tokens, not money paid; the page says so once and compares it with the prorated subscriptions. `cost-data.json` and `roles.json` carry issue titles and unit names that name helper accounts and run hosts, so `scripts/public-cost.ts` projects them to the numeric fields the page draws, through the same Vite plugin as the timeline. `src/cost/model.ts` derives every figure the page writes, and `src/cost/model.test.ts` checks the exports against each other (the price table reproduces each model's and each Pacific day's cost from the hourly tokens), pins the page's claims, and fails if any number in the page's text is not one the model derived from the data.

The story on `/` is the documenting agent's draft, placed verbatim. `data/story.md` is a byte-for-byte copy of it and `data/receipts/section-N.md` of its per-section dig files, both refreshed with `bun scripts/import-story.ts [path]`, which refuses a draft that no longer parses or no longer contains what the page anchors to it. `src/story/draft.ts` splits the draft into the title, the byline, six sections of paragraphs and quoted messages, and each section's sources; it never edits a character of the prose, and renders only two inline marks, `code` spans and *emphasis*. A section's sources are its key anchors from the draft's Receipts plus the source table of its dig file, and `src/story/sources.ts` puts them in plain words for the page (who, where, when): the files keep their cairn:// addresses, transcript turns and raw sequence numbers as the project's traceability, and the page prints none of them. The build and the tests load the draft through `scripts/story-module.ts`, so only the page copy and the plain sources reach the bundle and the draft's editorial header does not. What the page adds to each section (its anchor, dates, the one figure and the block it follows, the operator's short lines set again as margin quotes, the one outbound link) lives in `src/story/sections.ts`, and `src/story/story.test.tsx` renders the page and fails unless every paragraph of `data/story.md` is on it as a reader sees it (byte for byte, less the code and emphasis delimiters), the sources sit only inside the closed Sources disclosures and carry no cairn:// address, and every margin quote is the prose's own words.

The attempts chart draws each scored account's logged-in spans from a table in `src/attempts/model.ts`. Every span bound points at an event in the JSON, or at a clock time an event's text states, and the tests in `src/attempts/model.test.ts` fail if a bound no longer matches the data. The page's headline counts (attempts, hours, stops, deaths) are computed from the same model.

The tricks page reads `data/tricks.json`, written by hand from the documenting agent's evidence inventory: one object per technique, with what the game normally does, what the run did instead, why the server allows it, the run steps in plain words, and at most one before-and-after saving. A saving records its basis (measured, inferred or estimated), and a technique the sources never measured has no saving, so its card claims none. Sources stay in the JSON and appear only behind each card's closed `sources` disclosure. `src/tricks/model.ts` groups the techniques, orders each group by the share of cost a measured trick removes, and computes the page's headline; `src/tricks/model.test.ts` checks every chart has numeric figures and a basis, that no card text carries a bare run-step code, and the rulings on individual figures (the whole-run knife saving is inferred; Charge is published as its measured rate). A card names its clip by id; a card without one shows a one-line slot.

## Clips

Every game clip on the site is registered in `data/clips.json` (its file and poster under `public/clips/`, frame size, length, caption, time, run step and source in plain words) and drawn by the one `Clip` component in `src/clips/`: the poster with a single play mark, a hairline progress rule in the accent while it plays, and, for a lab clip, the server tick on screen, read from the `ticks` map the registry copies out of the lab trace. It never autoplays, loops or plays sound, and returns to the poster at the end. Clips run 10 to 15 seconds and stay under 3 MB; `src/clips/registry.test.ts` checks every entry against its files (the MP4's frame size and length, the poster's size) and that every clip is placed on a page. The finish-recording cuts follow RUNE tenet #4: cropped to the game canvas, never the login box, and timed from the SDK log stamps on screen, which run 4 s after the recording's nominal file offset. The story places clips as figures in `src/story/sections.ts`, which lets a section carry more than one figure.

## Fonts

Self-hosted under `public/fonts/`, both under the SIL Open Font License 1.1 (licences and `FONTLOG.txt` alongside):

- **Rune Serif**, a Latin subset of Source Serif 4 (Adobe, variable weight and optical size). The licence reserves the name "Source" for unmodified fonts, so the subset carries its own name.
- **IBM Plex Sans**, IBM's own unmodified Latin1 files at weights 400, 500 and 600.

## Deploying

Cloudflare Pages builds the site from `main`. The project is configured in the Cloudflare dashboard, not in this repository, so there is no `wrangler.toml`:

- Build command: `bun run build`
- Build output directory: `dist`
- No `404.html` is emitted, so Pages serves `index.html` for unknown paths and the client router handles `/attempts` and the rest.
