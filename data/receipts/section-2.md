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

