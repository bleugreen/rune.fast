# Lab films

Clip specs for the lab films rune.fast shows (tenet #5): the swarm's own scripts re-run on a local
lab server with rs-sdk's `film/` tooling, at a pinned rs-sdk commit, in a scratch clone (never the
operator's checkout). Each film writes `clip.mp4`, `trace.jsonl`, `feed.jsonl` and `meta.json`
(with the commit) on one clock; rs-sdk `film/README.md` describes the tooling.

| spec | script | what it shows |
| --- | --- | --- |
| `aereck.json` | `speedrun/lab/quests/aereck-burst.ts --lab --client=browser --talks=4` | Father Aereck's default conversation, alternating read page by page (1 tick a page) and in bursts of blind continues |
| `relog.json` + `relog-page.ts` | `speedrun/tools/relog-probe.ts --via=page --bank`, through the wrapper | the same-page relog: logout button, in-page login, the new session's first tick |
| `tutorial-skip.json` | `speedrun/skills/start.ts` (step module), setup `leaveTutorial: false` | a fresh account skipping Tutorial Island |
| `willow-knife.json` | `speedrun/skills/woodcutting.ts` (step module), `technique: knife`, Woodcutting 73 at the Taverley willows | the knife-on-logs reset: a log knifed and the tree clicked in the same tick, inventory tab open |

`aereck-burst.ts` attaches to the film tool's tab when given `--client=browser` without `--launch`.
`relog-page.ts` stands in for `speedrun/lab/measure-relog.ts`, which starts a Chrome of its own: it
starts only the page server (`proxy.ts`, which an in-page login needs for its one-time token) on the
web port + 6, and keeps the film tool's `minimal` page through the probe's navigation.

## Shooting

On a quiet Linux lab machine (a loaded one stretches ticks and starves the screencast, and the
footage stops showing the technique), in one batch per film:

```sh
git clone https://github.com/bleugreen/rs-sdk.git rs-sdk && cd rs-sdk && git checkout --detach 4f62822f
bun install --frozen-lockfile
(cd server/webclient && bun install --frozen-lockfile && bun run build)
(cd server/engine && bun install --frozen-lockfile && BUILD_VERIFY=false bun run build)
film/film.sh filmaer2 --clip=$FILMS/aereck.json --out=film/out/aereck
film/film.sh filmrelog3 --clip=$FILMS/relog.json --script=$FILMS/relog-page.ts --out=film/out/relog
film/film.sh filmtut2 --clip=$FILMS/tutorial-skip.json --out=film/out/tutorial-skip
```

`$FILMS` is this directory, copied somewhere stable. Each bot name must be new to the lab's save
state: the tutorial film needs an account still on Tutorial Island.
