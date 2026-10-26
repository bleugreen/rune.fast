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

The data lives in `data/` as the documenting agent exported it. `data/attempts-timeline.json` is checked in verbatim, including names the site must not publish (helper and lab accounts, a machine hostname, the previous record holder). The build never ships that file as is: `vite.config.ts` replaces the import with the projection in `scripts/public-timeline.ts`, which keeps only the fields the pages render and redacts those identifiers, and `bun run check:public` fails the check if any of them reaches `dist/`.

The attempts chart draws each scored account's logged-in spans from a table in `src/attempts/model.ts`. Every span bound points at an event in the JSON, or at a clock time an event's text states, and the tests in `src/attempts/model.test.ts` fail if a bound no longer matches the data. The page's headline counts (attempts, hours, stops, deaths) are computed from the same model.

## Fonts

Self-hosted under `public/fonts/`, both under the SIL Open Font License 1.1 (licences and `FONTLOG.txt` alongside):

- **Rune Serif**, a Latin subset of Source Serif 4 (Adobe, variable weight and optical size). The licence reserves the name "Source" for unmodified fonts, so the subset carries its own name.
- **IBM Plex Sans**, IBM's own unmodified Latin1 files at weights 400, 500 and 600.

## Deploying

Cloudflare Pages builds the site from `main`. The project is configured in the Cloudflare dashboard, not in this repository, so there is no `wrangler.toml`:

- Build command: `bun run build`
- Build output directory: `dist`
- No `404.html` is emitted, so Pages serves `index.html` for unknown paths and the client router handles `/attempts` and the rest.
