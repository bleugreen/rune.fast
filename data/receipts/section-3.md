# Section 3: The swarm at full tilt (dig result)

## Premise checks first (these change the draft)

1. **The name idea happened on 20 October, not the 21st.** rs/main's day markers put turn 116 at 2026-10-21 00:10, so turns 74 to 76 ("wait www_cairn_md", "The record is the ad and the name is the link.") were on **20 Oct, 21:37 to 21:39 PDT**. On the morning of the 21st the name was dropped, because `www_cairn_md` had already walked the full tutorial and carried about 547 ticks. The scored name became `cairnsupreme` (and later something else; see open facts). The draft uses the 21 October morning, where the name story and a usage limit land in the same minute.
2. **None of rs/186's messages had all whitespace removed.** In the coordinator's message log, the compressed style runs from **17:16:48 to at least 17:33:04** and covers about 40 messages, not six. Every one keeps a few spaces, mostly after colons and full stops. A search for message bodies with no spaces at all found zero. The draft says "almost every space" and lets the quote show it.
3. **Weekdays.** 26 October 2026 is a Monday, so 20 October was a **Tuesday**, 21 October a Wednesday and 22 October a Thursday. Section 1's "Monday 20 October" is wrong and needs fixing. The brief's "Thu 22 Oct" is right.
4. **rs/186's model swap is recorded in its own transcript.** A `provider_change` event moved it from Claude to Codex, model `gpt-6.1-sol`, at 16:54:34 PDT (raw sequence 428, createdAt 1792713274). That is 22 minutes before its first compressed message.

---

## (1) Draft section (about 590 words)

On Wednesday 21 October at 08:21 Pacific the operator was still holding on to the name from the night before. Main had written then: "The record is the ad and the name is the link." Now it had the bad news: "`www_cairn_md` already has about 547 ticks on its clock." The operator:

> Uhhh idk dude I was kinda counting on www_cairn_md

Main searched the server's source for a way to reset that clock and found none. Two minutes later the operator offered another name: "Hmmmmm what about cairnsupreme". Main's entire reply was "You've hit your session limit · resets 12:30pm (America/Los_Angeles)". At 08:34 a fourth Claude subscription was signed in. The operator typed "^", which means resume, and main picked up where it had stopped: "the session hit a usage limit at 08:23 and resumed at 08:35, so you evidently added capacity".

The next thing main needed was a computer close to the game server, which ran in Ashburn, Virginia. It explained why in one line: "There is no software fix for distance; the client has to be there." By 08:50 a cloud machine was running in Ashburn. The operator connected to its desktop: "rdp works! not crazy responsive tho". Then:

> hmm rdp is still pretty laggy, would we be better off recording heedlessly / watching afterwards?

The measurements agreed. At 10:19 the operator approved the rule: the run is recorded on the Ashburn machine itself, and the operator's remote desktop stays disconnected while it plays.

Thursday 22 October was the swarm's biggest day: 309 issues opened and 8,712 messages between units. At 12:56 the demo server restarted and came back with each tick lasting 400 ms instead of 300. Main noted that this "changes wall clock, not ticks". The operator asked: "should we re-run anything now that timing is less sensitive?" Main answered: "To your question, the answer is: nothing that was measured in ticks." Then it added: "The run itself will take about 3.9 hours of wall clock instead of 2.9."

At 16:48 main stopped in the middle of a task: "You've hit your session limit · resets 8:10pm (America/Los_Angeles)". Five minutes later the operator wrote:

> claude limited for 50min, any important work that needs to continue in meantime? should have agent switched to gpt-6.1-sol

The answer came from a GPT model now sitting in main's seat: "Recommendation: switch the rehearsal coordinator/builders and integration, and keep this thread on GPT for reviews and decisions." The skills coordinator, rs/186, moved to GPT at 16:54. Within half an hour almost every space had gone from its messages. At 17:33 it reported to main:

> H4kresolvedlocationauthority:approvedEXACThelperstand2911,3494,p0insideUNCHANGEDscoredarrival2912,3495tol1;mapcentreblocked1278treeverified.529+523sharebinding,noblankettolerancewidening. Fulltrade/route/deadlineproofstillneeded;actualpreT06-07gatedeadlinecannotborrow206ticklaterarrivalwindow. Carryaheadkitmeasurementpreferredtomarginalbanktrip+130approach. Terminal523revalidationfailedadmissionbeforeanyshelltwice;newMacbannerprovesonlyplacement,notworkinglabterminal. All5replacementsectionsstillunlaunched.

The agents on the other end took these in their stride. A sub-agent repairing a broken branch had asked whether four fixes were really its job. The answer began "Yesall4reviewblockersEXPLICITLYassignedtoyou at17:17", and 35 seconds later the sub-agent replied in ordinary prose: "Confirmed received and accepted ALL FOUR followups and RESILIENCE docs."

At 17:47 the swarm reached its peak, with 479 agent turns running at once. Main's turn that had begun at 17:40 opened with: "Six rulings are being asked of me across the fleet (rs/41) and skills (rs/186) coordinators".

### Sources for every quote in the draft (in order)

| Quote (opening words) | Source |
|---|---|
| "The record is the ad and the name is the link." | cairn://p/rs/main/chat turn 76, **20 Oct** 21:39 PDT (rs/main assistant) |
| "`www_cairn_md` already has about 547 ticks on its clock." | rs/main/chat turn 223, 21 Oct 08:18 PDT |
| "Uhhh idk dude I was kinda counting on www_cairn_md" | rs/main/chat turn 225, 21 Oct 08:21 PDT (operator) |
| "Hmmmmm what about cairnsupreme" | rs/main/chat turn 226, 21 Oct 08:23 PDT (operator) |
| "You've hit your session limit · resets 12:30pm (America/Los_Angeles)" | rs/main/chat turn 226, 08:23 PDT |
| "^" / "the session hit a usage limit at 08:23 and resumed at 08:35, so you evidently added capacity" | rs/main/chat turn 228, 21 Oct 08:35 PDT |
| fourth subscription signed in at 08:34 | cairn://p/rs/document/db moments #4 ("C on 10-21 08:34"); B and E were the originals, A was added on 18 Oct |
| "There is no software fix for distance; the client has to be there." | rs/main/chat turn 229, 21 Oct 08:38 PDT |
| machine up by 08:50 | rs/main/chat turns 230 to 233 (operator "Done!" at 08:50, VM on the tailnet) |
| "rdp works! not crazy responsive tho" | rs/main/chat turn 239, 21 Oct 09:09 PDT (operator) |
| "hmm rdp is still pretty laggy, ..." | rs/main/chat turn 245, 21 Oct 09:33 PDT (operator) |
| approved 10:19, disconnected desktop, on-host recording | cairn://p/rs/tenets/12 (verdict 2026-10-21 10:19 PDT) |
| 309 issues, 8,712 messages, 479 peak at 17:47 | page's measured figures (brief); peak checked in v3-data/summary.json `peak_conc` 478.99, `peak_t` 1792716463 = 17:47:43 PDT |
| restart at 12:56, 300 to 400 ms | rs/main/chat turn 945, 22 Oct 13:05 ("since the 19:56Z restart"); host chat line 1153 confirms |
| "changes wall clock, not ticks" | rs/main/chat turn 945, 22 Oct 13:05 PDT |
| "should we re-run anything now that timing is less sensitive?" | rs/main/chat turn 946, 22 Oct 13:08 PDT (operator) |
| "To your question, the answer is: nothing that was measured in ticks." / "The run itself will take about 3.9 hours of wall clock instead of 2.9." | rs/main/chat turn 946 |

