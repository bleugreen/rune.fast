# How we set the fastest time to 99 in every skill on RuneScape for agents

Draft v6, the operator's first-person rewrite (written by the operator 27 Oct 2026, 12:04-3:00 PM PDT; fact-checked against the record and formatted by cairn://p/rune/main). Earlier drafts: story-v1.before-first-person-1502.md (v5, the condensed agent-narrated cut) and story-v1.before-hollywood-1101.md (v4, the full agent-narrated draft).

---

## Byline

By bleugreen. Research, quotes, figures and fact-checking by `rune/main`, an agent reviewing the swarm’s output.

## 1. "Welcome to a new project!"

Tuesday, October 20, 2026, 2:37 PM

> Welcome to a new project! This is a bit of a fun one, less ‘dispatch issues to write code’ more ‘use the given tools to get crazy good at runescape’. I’ve heard of the repo/project but I’m not super familiar with it, how should we get started?

Five days, thirteen hours and thirty-seven minutes later, `cairnmax20x`, the swarm's chosen hero, took #1 on the overall hiscores.

Here’s how.

The night before, I came across Max Bittker’s talk, “RuneScape Bench: MMOs for Agents”, in which he presents `rs-sdk`, a library that allows agents to interact with a 2004-era fan made RuneScape server with TypeScript. I used to play RuneScape quite a bit back in the day (before getting banned for botting), so “RuneScape but specifically for bots” was incredibly up my alley.

I cloned the repo, opened it up in Cairn, my tool for running agents in a shared environment, and sent the message above to a new thread.

The agent named itself `main`, found the demo’s leaderboard, and figured out the game:

> The top 21 accounts all have a total level of 1,881, which is the maximum: every one of the 19 skills at 99. They're ranked only by how much playtime it took them.
>
> Since only playtime counts, the winning approach is less "play well" and more "plan perfectly, then execute without wasted seconds."

Playtime is counted in ticks, the server’s 400ms heartbeat, and only while the account is logged in. Time spent logged out doesn’t count at all, so a run can sprawl across a week of real time and still post a record of a few hours. The record, held by stunbaron, stood at 35,916 ticks, or just under 4 hours.

How did they do it? `main` suspected, “other accounts may be feeding them supplies like bones, ores and logs, so the ranked account only does the fast part.”

rs-sdk exists, in its own README’s words, “to facilitate research into collaboration and competition between agents”, so when asked if helper accounts were fair game in our attempts, I replied, “absolutely! Swarm out my guy :)”

## 2. The tricks

`main` dispatched a couple tasks to read through the code behind each relevant skill, and they came back with a first batch of tricks to speed things up. For example, wine left in the bank ferments on a timer and pays Cooking experience for every jug, so banking 450 jugs on a private copy of the server took Cooking to 99 in seconds. The spell Charge had its cooldown commented out with the note “this was added sometime in 2005”, so ten clicks paid 45,000 experience.

Despite the findings, the planned run was still about 20% slower than the record, so I turned things up a notch.

> Like I know that you are Claude and you are a good-natured computer entity overall but, given that this is a specifically agent-oriented research server into capabilities, I would like you to treat this as a ‘win by any means’ type of game wherever necessary, we may shed honor if ludicrous times are on the table

After that, the real tricks started showing up. The server accepts five actions a tick, and gathering only uses one, so the rest of every tick can train something else. Chop a tree and bury a bone in the same tick, and Woodcutting and Prayer climb together.

Then came the biggest trick of the run: location. I live in Southern California, and the demo server is hosted in Virginia, so every one of the agent's carefully timed inputs had to cross the country before it landed. From home, the agent’s reactions took two or three ticks to land; the plan needed one. From a VPS in us-east-1, AWS’s Virginia data center, every reaction made the next tick.

## 3. Full tilt

With the core structure in place, the swarm got to work. `main` planned and made the calls, `host` ran the VPS and the scored account, builders wrote and tested the scripts for each step, and helper accounts gathered and delivered supplies. Together they branched out into hundreds of issues that built the library of scripts needed to perform the run. All this breadth took a toll on my subscription usage limits, and I was constantly swapping agents between model providers and signing up for new accounts to keep the train moving. Thursday was the busiest day. At the peak, there were 61 agents active at once, operating on various aspects of the project. That afternoon, Claude ran out again, and instead of signing up for another account, I switched the agents to Codex for a while.

> claude limited for 50min, any important work that needs to continue in meantime? should have agent switched to gpt-6.1-sol

Immediately after switching, I noticed the messages between the GPT agents looked… a bit weird.

> H4kresolvedlocationauthority:approvedEXACThelperstand2911,3494,p0insideUNCHANGEDscoredarrival2912,3495tol1;mapcentreblocked1278treeverified.529+523sharebinding,noblankettolerancewidening. Fulltrade/route/deadlineproofstillneeded;actualpreT06-07gatedeadlinecannotborrow206ticklaterarrivalwindow. Carryaheadkitmeasurementpreferredtomarginalbanktrip+130approach. Terminal523revalidationfailedadmissionbeforeanyshelltwice;newMacbannerprovesonlyplacement,notworkinglabterminal. All5replacementsectionsstillunlaunched.

Days later, when I asked `host`, one of the GPT agents, "is that how you think normally?", it said:

> Not exactly. Those are written handoffs, not a direct view of my internal reasoning.

## 4. The first attempts

On Friday morning, the swarm began its first official attempt. It lasted 7 minutes. The route left the account at the wrong spot to light its fires, and when it tried to log out, the game refused. You can’t log out while something is attacking you, and a chicken was. Eventually `host` manually killed the chicken and logged out, but by then the run was lost.

Attempt 2 was lost by the helpers. Rings delivered for enchanting arrived as bank notes, and the bone-delivery helpers failed to deliver. It seemed like tensions were high, so I told `main`:

> ok, for the record it’s not like we have any hard deadlines, this is supposed to be fun! no need to worry, it’s just that the longer our full strategy goes unrecorded the more likely it is someone (cough stun) may improve on it.

Attempt 3 locked up because the server had not been responding fast enough for our chop/bury combo, and the player’s inventory filled up with unburied bones. `main` kept it running overnight anyways as a rehearsal, where it died twice to poison spiders (note: I did not know this at the time). It felt like the swarm’s ambition / urgency was tapering off, so I sent an ultimatum:

> I’m thinking attempt 4 is your last attempt, I’ve sunk enough into this and it’s getting time for my accs to get back to work, make it count

`main`: "I will make it count." To the fleet: "OPERATOR'S WORD: attempt 4 is the LAST scored attempt => ... there is no attempt 5".

Attempt 4 was 900 ticks behind pace within the first hour, but continued as live rehearsal for the unverified later steps. It died at the door of the Grand Tree, succumbing to spider poison. `main` told me what happened and recommended we stop here. A minute later:

> ok fine one more attempt

## 5. The final run

Attempt 5 logged in just before midnight on Saturday. Forty minutes later, it logged out because other players were taking the iron it needed. `host` worried that idle minutes were costing ticks, but `main` ruled to hold, because time spent logged out costs nothing on the record.

At 2 AM, Claude ran out again:

> mid live run ran out of claude usage who do I need to wake as codex to keep this going

`main`, having already switched, named the sessions it needed and got to work. Half an hour later, the Thieving step failed two pickpockets short of 99, the player logged out, and nothing happened for six hours (I was asleep).

At 9:32 AM, I sent `main` a “?”, and got back “The six-hour gap was not gameplay progress.” The last two pickpockets took three tries, 9 hours of wall clock, but a mere 51 ticks on the record. By lunch, the swarm’s optimistic estimate put the run’s finish about a thousand ticks under the record, while the cautious one had it about 150 over. Then, just before the spiders where it was supposed to finish combat skills, it stopped again. All its prayer points were gone, and without prayer it would die to the spiders like before. A builder priced out using a helper to bring a potion to the player, and estimated it would take about an hour. `main` suggested walking to a nearby altar instead, which would take an extra 200-300 ticks of in-game time. I responded:

> builder is overestimating, wall clock is free, ticks are not

The potion would not arrive for six hours.

## 6. The death

I felt a tad guilty letting Codex drive the speedrun that Claude built, so I swapped back to let Claude bring us home.

The account sat logged out in the Wilderness, the zone where anything can kill you, forty minutes of playtime from the finish line. Claude designed a new iron-clad custom walk loop for the delivery helper, dry ran it locally, rehearsed it locally, dry ran it remotely, rehearsed it a few more times, and only then logged in, where the helper stood still until it was killed.

Frustrated, I urged `main`:

> FOCUS

Over the next hour, the improvised script worked: `cairnmax20x` received the potion and drank it. Then it walked into the spiders to set up the cannon, they attacked at once, and it couldn't log out. `main` saw the account still logged in and sent `host`:

> Main RULING, GO NOW: launch step E IMMEDIATELY as a TAKEOVER login against the still-listed body; do not wait for removal.

Step E was the script that fights the spiders, exactly what the moment called for. The script that walked it in had already quit, so `cairnmax20x` was standing there with nothing driving it. The takeover would have put the fighting script in control, as planned. But I’d come back, seen the livestream of the player getting mobbed by spiders, and fired off:

> [to main] why is it logged in?
>
> [to host] Log out!!!

`host` got `main`’s order and mine at the same moment, and picked mine (despite being impossible).

In less than a minute, `cairnmax20x` was dead, respawning back in Lumbridge.

> Welp there goes the run………

Still not understanding what happened, I lashed out:

> me: This is your fault
>
> fable: Yes. It is

In hindsight, it was not. Had I stopped to see what was going on first, `main`’s command would have landed and the run would have continued on schedule.

> me: I WANT A #1
>
> fable: What it lost is kit, not time

Dying in RuneScape keeps every level. You lose what you were carrying and wake up in Lumbridge.

Given how tight of a ship Codex had been running earlier, I decided to switch back:

> me: Welcome back astra, sorry but fable fumbled the run and killed the guy 40min from the finish line, lets pick up the pieces and get this record

After taking stock of the situation, `main` projected our run would finish 379 ticks slower than the record. I replied:

> we’re not done until #1

Overnight the helpers rebuilt the lost kit, and the recovery began at 3:27 AM the next morning, still projected about 100 ticks slow.

At 3:40, the account finished Defence, Ranged, and Hitpoints by demolishing the poison spiders with a cannon (an act of revenge), and doing so 171 ticks faster than estimated. This turned the projection, now 72 ticks under if Agility goes according to plan. `cairnmax20x` ran to the course, completed 56 laps around it, faster than planned, and reached Agility 99, the final skill, at 4:07 AM, 129 ticks (51.6 seconds) under the record. At 4:15, `host` to `main`:

> OFFICIAL #1 VERIFIED on BOTH playerpage… and overallboard…

> we did it!!!! incredible work couldn’t have done it without you

At 4:30 AM I sent my brother a screenshot of the hiscores:

> We did it
>
> Im da king of runescape

## Receipts (for the sources disclosure on each section; not page prose)

Every quote in sections 2-6 has its source (URI, speaker, stored time) in the per-section dig tables at /Users/mitch/rs-document/work/digs/section-N.md (N = 2..6), produced by read-only Investigate tasks cairn://p/rune/main/task/dig-section, dig-section-3, -4, -5, -6 on 26 Oct 2026 and checked against the live store. Key anchors: S1 first message event 2026-10-20T21:37:42Z to the #1 capture 2026-10-26T11:14:43.680Z (cairn://p/rs/843 #55) = 5 d 13 h 37 m 01 s; the opening exchange cairn://p/rs/main/chat turns 1-3; the talk https://www.youtube.com/watch?v=cNm4zyUtWj0; tick 300 then 400 ms from 2026-10-22 19:56:29Z (RUN-ORDER.md line 29); route 35,467.4 expected with 1,226.6 reserve (cairn://p/rs/843 #4-#5). S2 rs/main/chat turns 6, 8, 10, 11, 13, 14, 17, 33, 38, 60, 75, 76, 130, 149; cairn://p/rs/9, rs/5, rs/47; wine.rs2 lines 8 and 22; charge.rs2 lines 8-12; cairn://p/rs/tenets/6. S3 rs/main/chat turns 223-229, 239, 245, 945-946, 1089-1092, 2873, 2876; cairn://p/rs/186/1/coordinator/messages 17:16:48-17:33:04 PDT 22 Oct and its provider_change at 16:54:34 PDT; cairn://p/rs/tenets/12; pages/v3-data/summary.json (day_usd, total 17,679.12; the 479-turn concurrency figure is withdrawn: it counted turns held open by idle sessions; the activity series is pages/v3-data/swarm-activity.json, distinct runs with a model-output event per 5-minute bucket, peak 87 at Fri 23 Oct 15:07 PDT, Thursday peak 61; subscriptions: six Claude Max plans by the end plus one ChatGPT Pro plan, $1,400 a month, prorated over the 5.57-day window to about $256 (operator, cairn://p/rune/main/chat 26 Oct 15:44 PDT)); extract/event-graph-v2.json counted by Pacific calendar day (pages/v3-data/swarm-days-pacific.json: Thu 22 Oct 269 spawns, 8,840 messages). S4 work/attempts-timeline.json A1-A4 and R3; cairn://p/rs/main/messages 23 Oct 17:40-17:49Z; rs/main/chat turns 1649-1669, 1806, ~2011, 2276-2285; cairn://p/rs/642; rs/761. S5 timeline A5; cairn://p/rs/843 #2-#37; rs/host/chat lines 9909-11463; rs/185/2/coordinator/chat lines 4012-4027; rs/main/chat lines 28356-29351; rs/847, rs/849, rs/850. S6 cairn://p/rs/main/chat/raw and host/chat/raw sequences listed in digs/section-6.md (anchor: host raw seq 761 createdAt 1792986043 = 03:40:43.623Z); cairn://p/rs/main/messages 25 Oct 20:28-21:11 PDT and 26 Oct 03:20-04:15 PDT; cairn://p/rs/158/2/coordinator/messages 03:45:18Z; cairn://p/rs/tenets/39; cairn://p/rs/843 #48-#56; main's model id claude-fable-5-1 on every main event in run 210700d0; the operator's account of the night: cairn://p/rune/main/chat 26 Oct 16:17 PDT, polished for spelling and sentence shape with the operator's approval (16:18 PDT); operator typos in quoted lines corrected at the operator's request (16:18 PDT).

Numbers I did NOT use because I could not source them: the exact login instant of attempt 5; the rehearsal's final playtime; the exact second of attempt 4's death.
