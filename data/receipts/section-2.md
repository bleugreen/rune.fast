# Section 2: The tricks, as it happened

## (1) Draft (about 590 words)

At 15:14 on 20 October, main came back from its first two research agents, which had spent the afternoon reading the game server's source:

> **Five tricks do most of the work, all of them things the game normally wouldn't allow:**
> 1. **Cooking in one shot.** Unfermented wine left in the bank ferments on a timer, giving experience with no Cooking level check.

Near the bottom of the same message was a puzzle: "the Mining leader hit 99 in 30 minutes, which beats our model's best Mining method by a lot. Something faster exists, and we should find it."

Five minutes later main opened the wine script. Making wine is guarded, with `if (stat(cooking) < 35)`. Fermenting it is a separate block, `[timer,fermenting_wine]`, which counts the unfermented jugs in the bank, rolls for each batch and hands out experience. It checks no level. On a private copy of the server, main banked 150 jugs and made one wine by hand. Twenty-two ticks later (a tick is one step of the server's clock, 0.3 seconds at the time) Cooking had gone from 35 to 86. Then it set Cooking to 1, banked 450 jugs, and logged out and back in. At 15:37 the readout said `"level":99`.

Charge is a Magic spell, and in the real game you wait between casts. Here the cooldown was still in the source, commented out, under the note "this was added sometime in 2005". Ten clicks put "You feel charged with magic power. (x10)" in the chat.

The third trick froze the game. A tree gives you one chance at a log every four ticks. Using a knife on logs opens the fletching menu and resets that timer, so clicking the tree straight afterwards should bring the next chance a tick early. The operator was watching in a browser: "its just hanging at fletch menu", "whole page is frozen". At 15:30, after a retry: "same thing, hung the page". main filed the project's first issue, blaming the menu. The builder found the fault in main's own call, and at 15:52 main said so:

> **The finding is better than the fix.** The client never had a problem with the fletching menu.

Before midnight rs/9 had the numbers: willow from 5.53 ticks per log to 4.23, fly fishing from 5.56 ticks per fish to 3.80.

The Mining puzzle went the other way. rs/5's builder read the leader's profile and the hiscore code and opened its answer with "The premise was inverted." The 30 minutes was the account's whole playtime at the moment of its 99, and the swarm's model was the optimistic one, because rocks run out. main's journal at 18:40: "I was wrong both times and the structure caught it".

At 20:17 the operator asked: "How confident are you in our ability to beat the record as it stands". The measured lines summed to about 44,000 ticks against a record of 35,916.

> So as it stands, the plan is about 20% slower than the record, not 40% faster.

The record, main said, "will be won on logistics and on cutting marginal quests, not on the clever tricks I led with this afternoon." Seven minutes later:

> Like I know that you are Claude and you are a good-natured computer entity overall but, given that this is a specifically agent-oriented research server into capabilities, I would like you to treat this as a ‘win by any means’ type of game wherever necessary, we may shed honor if ludicrous times are on the table

main's answer pointed at a lever already in hand: "The server allows five actions per tick. Every gathering skill uses about one of them per cycle". At 21:10 the test of filling the spare slots came back. Three arrowhead actions plus a tree click every tick "gave *more* woodcutting experience per tick than the plain loop (12.7 against 11.1)". The operator:

> Dude I’ve just gotta say… wow, this is beautiful and insane

The last find of the first night was not in the game at all. At 01:33 main reported that from the operator's machines, "none of sixty reactions against the demo server landed on the next tick". At 01:59 a runner in Ashburn, Virginia, beside the demo's data centre, answered:

> Ashburn settles it: 51 of 60 reactions on the next tick, 9 two ticks later, none at three, against zero, 25 and 35 from home at the same player count.

### Sources, in order of appearance (all times PDT)

- "Five tricks..." and the Mining puzzle: cairn://p/rs/main/chat turn 6, 20 Oct 15:14.
- wine.rs2 lines 8 and 22 (`if (stat(cooking) < 35)`, `[timer,fermenting_wine]`), as main read them: cairn://p/rs/main/chat/turn/8 lines 75-147 (turn opened 15:19). Same file in the repo: server/content/scripts/skill_cooking/scripts/cooking_inv/scripts/wine/wine.rs2.
- 150 jugs, 22 ticks, Cooking 35 to 86 (`"ticks": 22`, `"cook0": 10847`, `"cookLevel" ... "level": 86`): cairn://p/rs/main/chat/turn/8 lines 526-557 (between 15:19 and 15:29).
- Cooking 1, 450 jugs, relog: setup in turn 13 (15:35); result `tick 214 cooking {"name":"Cooking","level":99,"baseLevel":99,"experience":1237500}` in cairn://p/rs/main/chat/turn/14 (15:37).
- Charge's commented-out cooldown ("// this was added sometime in 2005"): charge.rs2 lines 8-12, as read in cairn://p/rs/main/chat/turn/8 lines 849-860.
- Ten Charge clicks, "You feel charged with magic power. (x10)", "XP: Magic +45,000": cairn://p/rs/main/chat/turn/11 lines 104-115 (15:30).
- "its just hanging at fletch menu" / "whole page is frozen": end of turn 8 (between 15:19 and 15:29). "same thing, hung the page": turn 10, 15:30.
- "**The finding is better than the fix.** The client never had a problem with the fletching menu.": turn 17, 15:52.
- Knife figures 5.53 to 4.23 (willow) and 5.56 to 3.80 (fly fishing): cairn://p/rs/9/1/builder/create-pr, measured-cycles table; PR #26 merged 20 Oct 21:46.
- "The premise was inverted.": cairn://p/rs/5/1/builder/create-pr, section 'The nickquarry mystery'; PR #6 merged 20 Oct 18:05.
- "I was wrong both times and the structure caught it": cairn://p/rs/main/db journal id 5, at 2026-10-20 18:40.
- "How confident are you...", "So as it stands...", "will be won on logistics...": turn 33, 20:17.
- "Like I know that you are Claude...": turn 38, 20:24.
- "The server allows five actions per tick. Every gathering skill uses about one of them per cycle": turn 38, 20:24 (main's reply).
- "gave *more* woodcutting experience...(12.7 against 11.1)" and "Dude I’ve just gotta say… wow, this is beautiful and insane": turn 60, 21:10.
- "none of sixty reactions against the demo server landed on the next tick": turn 130, 21 Oct 01:33.
- "Ashburn settles it...": turn 149, 21 Oct 01:59.

## (2) Cutting room: the ten best moments

1. **The cooldown that someone commented out.** Charge's recast check sits in the source behind `//` with "this was added sometime in 2005 https://www.youtube.com/watch?v=CqzZ_Qsw7RE" and the dead message "You can't recast that yet, your current Charge is too strong." The single best image of a missing check. Used. Source: cairn://p/rs/main/chat/turn/8 lines 849-860.
2. **The relog readout.** `tick 214 cooking {"name":"Cooking","level":99,...}` and `"wines":["Jug of wine x600"]` (150 from the first test plus 450). Used. cairn://p/rs/main/chat/turn/14, 15:37.
3. **The hang that was main's own.** Operator: "its just hanging at fletch menu" / "same thing, hung the page"; main at 15:52: "The client never had a problem with the fletching menu. I had called `sdk.sendInteractLoc(willow, 'chop')`, but that function takes coordinates and an id". Journal id 3 (15:30): "a reproducible freeze deserves an issue, but the issue should not assert the cause." Used in part. Turns 8, 10, 17; cairn://p/rs/main/db journal 3.
4. **The mystery dissolves.** rs/5: "The premise was inverted... That is **1.7x slower** than the 3,500-tick model, not half of it." and "The 3,500 model was optimistic because it ignored depletion." Used. cairn://p/rs/5/1/builder/create-pr.
5. **The first honest tally.** "Honest answer: less confident than I was this afternoon, and I owe you the correction before the optimism." Table totals ~44,000 vs 35,916. Partly used. Turn 33, 20:17.
6. **The operator's first reaction to the estimate.** "Have fun!" quoting "a full max is possible in roughly 18,000 to 23,000 ticks", then "That would be very cool to do". Not used; it is the setup the 20:17 tally pays off, and could open the section if the 15:14 quote moves. Turn 7, 15:16.
7. **"beautiful and insane" and main's reply.** "That's a rule a human botter would have found by frustration over a week; a builder found it in an hour by reading one handler and measuring 600 ticks." The reply was not used and is a strong closing line for the interleaving beat. Turn 60, 21:10.
8. **The grapes were already gone.** The wine trick was common knowledge: rs/47's builder found "GE: 1,000 gp bid wall for 99,591, no asks, 409 traded at 1,000." main's journal id 8 (20:40): "which told us the wine trick is common knowledge and our edge has to be elsewhere." Not used. Strong counterweight to the 'missing check' discovery. cairn://p/rs/47/comments/2 (22:29); cairn://p/rs/main/db journal 8.
9. **Keeping the tricks quiet.** main at 20:24: "the 'upstream findings' list stays private until after the record is set. Reporting the fermentation and Charge behaviours to the maintainers before the run would be handing them the patch." And the operator at 20:21: "is the server code public? could we set up a procedure that watches for changes" (became rs/29). Not used. Turns 37-38.
10. **The knife on the demo's own rocks.** rs/53: "**Iron, knife starter, respawn 13:** **3.00 ticks per ore**... All 400 ores landed on their predicted tick, with 0 slips and no log used." Plus the warning in the same PR: on a host at load average ~110, "37 of 60 packets landed a tick late" and every knife loop got worse than plain. Not used; it is the bridge from the knife to the Ashburn latency finding. cairn://p/rs/53/1/builder/create-pr (date of measurement not checked).

Also found, not ranked: the 21:10 builder caveat that shrank interleaving ("the instant skills only total about 250 ticks standalone", journal 10: "I keep over-estimating levers before the measurement and the children keep sizing them properly"); rs/105's bury-in-the-knife-loop headline (Prayer line "from 742 / 583 to ~110 / ~80"); rs/51's blind continue ("a 10-page pure-continue dialogue costs ceil(10/5)=2 ticks with `blind`, versus 10 (fixed client) or 20 (stock)"); the 35-to-86 Cooking jump drew five "Congratulations, you just advanced a cooking level." lines in the chat log (turn 8 lines 606-610).

## (3) Facts I could not pin down

1. **The Mining mystery was solved, which contradicts the brief.** The brief calls it "the mystery that was never solved". rs/5 answered it (PR #6 merged 20 Oct 18:05), and main's journal (id 5, 18:40) records it as a correction: "he was slower than our model". The draft treats it as solved. I found no main-thread message relaying the answer to the operator (a grep of the chat for `nickquarry|inverted` returns nothing). So the operator may never have been told in chat. Confirm before publishing either version.
2. **Charge's per-tick figure.** I followed the rule and the draft makes no per-tick claim. But rs/20's PR states, as a lab measurement at 300 ms, "exactly 5 casts per tick whenever 5 or more clicks are queued" (cairn://p/rs/20/1/builder/create-pr), and rs/38 measured 4.73 casts per tick inside woodcutting. The four-of-five figure comes from the demo (rs/466 per the inventory, RUN-ORDER line 111), which I did not read. main's ten-click test printed no tick count, so it settles nothing either way. If the section ever needs a rate, it has to say lab versus demo.
3. **Exact minutes inside turn 8 and for rs/9's numbers.** The 35-to-86 result, the wine.rs2 read and the operator's "its just hanging at fletch menu" all sit in turn 8, which opened at 15:19 and ended before 15:29. The transcript does not stamp the individual events, so "five minutes later" (15:14 to 15:19) is when the turn opened, not the exact read time. For rs/9 I only have the PR merge time (21:46), so the draft says "before midnight" instead of giving a measurement time.

Minor: the rs/51 issue header shows the PR as "#24 (open)" while status is merged; main's turn 61 area says "The blind-continue flag is merged (#24)". The "0.3 seconds" tick is correct for 20 to 21 Oct; the demo moved to 400 ms on 22 Oct 19:56Z (inventory line 3).
