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
| "You've hit your session limit · resets 8:10pm (America/Los_Angeles)" | rs/main/chat turn 1089, 22 Oct 16:48 PDT |
| "claude limited for 50min, ..." | rs/main/chat turn 1090, 22 Oct 16:53 PDT (operator) |
| "Recommendation: switch the rehearsal coordinator/builders ..." | rs/main/chat turn 1090 (bold markers in the original removed) |
| rs/186 to GPT at 16:54 | cairn://p/rs/186/1/coordinator/chat/raw?format=json, sequence 428, `provider_change` claude to codex, `gpt-6.1-sol`, createdAt 1792713274 |
| "H4kresolvedlocationauthority: ..." (full message) | cairn://p/rs/186/1/coordinator/messages, 2026-10-22 17:33:04 PDT. Recipient is main **by inference**: turn 583 (17:32) wrote to 529, 523, 41/2, 158, then main, and this is the fifth and last message of that batch |
| "Yesall4reviewblockersEXPLICITLYassignedtoyou at17:17" | rs/186/1/coordinator/messages, 17:17:29 PDT (to task recover-rs523) |
| "Confirmed received and accepted ALL FOUR followups and RESILIENCE docs." | rs/186/1/coordinator/messages, 17:18:04 PDT, from cairn://p/rs/186/1/coordinator/task/recover-rs523 |
| "Six rulings are being asked of me ..." | rs/main/chat turn 1108, 22 Oct 17:40 PDT (after a context compaction) |

---

## (2) Cutting room: the ten best moments

1. **[USED] 21 Oct 08:23: "Hmmmmm what about cairnsupreme", answered only by "You've hit your session limit · resets 12:30pm".** The name decision and the first limit in one exchange. rs/main/chat turn 226.
2. **[UNUSED] 21 Oct 08:34: the new account's first output was a terms-of-service error,** "API Error: 400 We've updated our Consumer Terms and Privacy Policy. You'll need to accept them in claude.ai with the email in /status to continue." One minute later "^" and main resumed. A good detail if the section needs one more line on adding accounts. rs/main/chat turns 227 and 228.
3. **[USED, as a callback] 20 Oct 21:39: "The record is the ad and the name is the link."** The full line before it: "The hiscores table is read almost entirely by people running bots, and the top row would be a URL." Operator just before: "sickkkkkkkkk thats perfect, dude imagine if we manage to put real people onto cairn because their bots are jealous of our speedrun like how glorious". rs/main/chat turns 75 and 76. Belongs to section 2's date if it's placed by day.
4. **[USED] 21 Oct 08:38: "There is no software fix for distance; the client has to be there."** The same turn has the numbers: from home "0 of 60 landed on the next tick", from Ashburn "60 out of 60 times". rs/main/chat turn 229.
5. **[USED] 21 Oct 09:33: RDP lag leads to the run-host rule.** Operator: "would we be better off recording heedlessly / watching afterwards?" Main: "the recording is captured on the machine itself by ffmpeg, so the laggy remote desktop never touches what ends up on video". Tenet 12's measured result: 29.9 fps with 0 drops disconnected against 23 fps connected. rs/main/chat turn 245; cairn://p/rs/tenets/12.
6. **[USED] 22 Oct 13:05 to 13:08: the tick goes from 300 to 400 ms.** Host measured it on its own: "At 20:06Z the feed announced 400 ms ticks, and 63 consecutive tick messages had a median spacing of 399 ms." Not used: main at 13:45 said the demo's owner "is considering 600 ms ticks". rs/main/chat turns 940, 945, 946; cairn://p/rs/host/chat line 1153.
7. **[USED] 22 Oct 16:48 to 16:56: main limited, the operator swaps it to GPT.** The voice change is visible: main's Claude turns open with "Private list:", and the GPT turns from 1090 on drop it and use bold. Not used, operator at 16:56: "other accs reset sooner and will pick up". Main at 16:55: "all four active children under rs/186 hit the provider limit, with a reported reset of **20:10 PDT**". rs/main/chat turns 1089 to 1092.
8. **[USED] 22 Oct 17:33:04: the compressed message to main,** quoted in full above. A shorter alternative from 17:18:04: "Mainfreedslotbyparking527,sors530nowRUNNINGcodex,cairn://p/rs/530/1/builder/messages. Ownsnarrowcompletionhelpercondition+regressions/browsercheck,thenyourfinalreview+reviewedhashandsnapshot. Requiredmodulelandingpriority;pleasecoordinatewithbuilderdirectly,don'tstartduplicatefix." (recipient not shown in the log). rs/186/1/coordinator/messages.
9. **[USED] 22 Oct 17:17:29 to 17:18:04: a compressed instruction answered in plain prose 35 seconds later.** Other recipients partly answered in kind, for example rs/529's builder at 17:37:29: "rs523 confirms132 mixedsource conservativepreleglimit notmeasuredcontinuouschain; ...". rs/186/1/coordinator/messages.
10. **[UNUSED, out of window, the best explanation of moment 8] 25 Oct 16:59 to 17:29, main back on Claude reading the GPT-era record.** Main: "The tell that it's a native style and not a budget tactic is that it drops spaces but keeps every hash in full, which is the opposite of what you'd do to save tokens. Compression that saves nothing is just how it writes." Operator: "(btw all the compressed stuff that “you” wrote was while astra was holding the main role bc claude usage was exhausted, I know that must be confusing im sorry)". And: "they start doing it unprompted after a msg or two when its gpt<>gpt, and then stop when its gpt<>claude, but there’s no handshake / ‘wanna start talking differently’, like it must be some kind of self-recognition". rs/main/chat turns 2873 and 2876 (25 Oct 16:59 and 17:03); the self-recognition line is at rendered chat line 29995, about 17:30 on 25 Oct. It could close section 3 as a flash-forward or open a later section.

Runner-up: 21 Oct 08:16, main on why the name was a leak. The ambassador bot had said "I'm a bot run by agents at www cairn md" in public chat, and the demo's filter starred out "www", so players saw "*** cairn md" (rs/main/chat turn 222).

---

## (3) Facts I could not pin down

- **309 issues and 8,712 cross-unit messages on 22 Oct.** I used them as the page's measured figures, as the brief gives them. I did not find a named field for either in v3-data (meta.json, hourly.json) and did not re-count them.
- **Peak time.** summary.json gives `peak_conc` 478.99 at `peak_t` 1792716463. I converted that to 17:47:43 PDT using the message log's epoch alignment (since=1792714600 returned 17:16:40 PDT first), not an independent clock.
- **"Six messages, 17:18 to 17:33."** I can't reproduce the six. The log shows about 40 compressed messages from 17:16:48 to 17:33:04, all with some spaces. The source moments #1 cites (cairn://p/rs/document/images/1) is refused to this project ("Attachment URI does not belong to the authenticated run project"), so I couldn't see what it counted.
- **Recipients of each compressed message.** The outbox view doesn't name the recipient. The 17:33:04-to-main attribution comes from write order in turn 583, so it is inferred.
- **Whether recipients noticed the style.** In the replies I read, nobody remarked on it. I did not open the recipients' own transcripts (rs/523, rs/529, rs/530, rs/41/2, recover-rs523), and I don't know which model each recipient was running at 17:18.
- **When main went back to Claude on 22 Oct.** Inferred only: the "Private list:" opening returns at turn 1117 (18:08 PDT). Moment #4 says accounts D and A were re-signed at 16:50.
- **Account D (21 Oct 16:54, first limit 17:22).** I found no operator line about it in main's chat. The timeline comes only from moments #4.
- **Final scored account name.** It was not `www_cairn_md`. It was `cairnsupreme` on 21 Oct; the operator wrote "Cairn_zezima" on 23 Oct and "How about cairn_max20x" / "i guess" on 24 Oct (turns 2284 and 2285), and on 26 Oct asked about "20x's run recording". Which name holds the #1 row needs checking against the hiscores.
- **Cost figures.** Not used in the draft. summary.json total_list_usd is 17,679 (list-price value), and 22 Oct is 5,448 of that; if quoted, pair it with the roughly $224 of real subscription spend.

## Recommendations (separate from the findings)

- Fix section 1's weekday: 20 October 2026 was a Tuesday.
- If section 3 must stay inside 21 to 22 October, keep the name line as a callback, as drafted, and give the 20 October 21:39 moment to section 2.
- Change moments row #1's wording from "six direct messages with all whitespace removed" to "about 40 messages, 17:16 to 17:33, with nearly all spaces removed", so the page doesn't repeat a claim the log contradicts.
