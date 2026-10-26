# Upstream provenance

Imported RS World from https://github.com/MaxBittker/rs-world at immutable revision `605fac4db3eb9840f24f854db9a22dafd24e9ca6`. Imported `src/`, `public/`, `scripts/`, CRACO/TypeScript/Prettier configuration, package manifest, Yarn lockfile, LICENSE and DESIGN.md. No deployment workflows or Git hooks were imported.

The retained BSD-2-Clause license and source notices apply to the original rs-map-viewer work. RS World credits rs-sdk and LostCity (MIT), Jagex, RuneLite, OpenRS2 Archive, RuneScape Archive, OSRS Wiki, 2004scape, 2009scape, RuneStar, Blurite and RuneApps Model Viewer. Credits and license attribution remain reachable in the dashboard footer. Cache data is not included in this repository; startup acquires it from the approved public source, subject to upstream data rights.

Local changes implement a loopback-only read-only dashboard, sanitized supervisor telemetry, fixed public feed, safer cache acquisition, and live lifecycle validation. Upstream DESIGN.md describes the original architecture, not authority to start a game server. See README.md and docs/ for local operation and boundaries.
