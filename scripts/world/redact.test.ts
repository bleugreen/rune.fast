import { describe, expect, test } from 'bun:test';
import { INITIAL_GATE, gateFrame } from '@rune/world/live/FeedGate';
import { formatCheckpointLine, formatFrameLine, type ReplayFrame } from '@rune/world/replay/clip';
import { cutChunks } from '@rune/world/replay/cut';
import { ArrayFrameSource, Playhead } from '@rune/world/replay/Playhead';
import { fixtureFrames, stubController } from '../../packages/world/test/stubs';
import { CLIPS } from './clips';
import { RedactionError, Redactor, appearanceAccount, scanEmitted, slotName } from './redact';

// The fixture's accounts are fictional: Alpha One stands in for the scored account and may be
// published; Bravo Two stands in for everyone else and must not survive anywhere.
const SCORED = 'Alpha One';

function publishFixture(follow?: string) {
  const redactor = new Redactor(SCORED, follow);
  let gate = INITIAL_GATE;
  const frames: ReplayFrame[] = [];
  for (const frame of fixtureFrames()) {
    const r = gateFrame(gate, frame.msg);
    gate = r.state;
    if (r.verdict !== 'drop') frames.push({ recv: frame.recv, msg: redactor.redact(frame.msg) });
  }
  const { controller, handlers } = stubController();
  const playhead = new Playhead(controller.world, handlers, new ArrayFrameSource(frames));
  const chunks = [...cutChunks(playhead, 30)].map((c) =>
    [formatCheckpointLine(c.checkpoint), ...c.frames.map(formatFrameLine)].join('\n') + '\n',
  );
  return { redactor, chunks, frames };
}

describe('redaction', () => {
  const { redactor, chunks } = publishFixture();
  const all = chunks.join('');

  test('no other account survives anywhere: rosters, appearances, chat, NPC text or checkpoints', () => {
    expect(redactor.names).toEqual(new Set(['bravo_two']));
    expect(all).not.toMatch(/bravo/i);
    for (const [i, chunk] of chunks.entries()) {
      expect(scanEmitted(`chunk-${i}`, chunk, redactor.names, redactor.scored)).toEqual([]);
    }
  });

  test('the scored account survives, in rosters and its appearance', () => {
    expect(all).toContain('"Alpha One"');
    const aps = [...all.matchAll(/"ap":"([A-Za-z0-9+/=]+)"/g)].map((m) => appearanceAccount(m[1]!));
    expect(aps).toContain('alpha_one');
    expect(new Set(aps)).toEqual(new Set(['alpha_one', 'slot_2']));
    expect(redactor.followSlotsBetween(0, Number.MAX_SAFE_INTEGER)).toEqual([1]);
  });

  test('counts what it did', () => {
    expect(redactor.counts.rosterNamesReplaced).toBe(12);
    expect(redactor.counts.appearanceNamesReplaced).toBe(1);
    // Bravo Two's chat and Alpha One's own overhead line: player text is never published.
    expect(redactor.counts.playerTextDropped).toBe(2);
    expect(redactor.counts.npcTextDropped).toBe(1);
    expect(all).not.toContain('lights a fire');
  });

  test('the scan catches a name, an appearance and a forbidden identifier it is shown', () => {
    const names = new Set(['bravo_two']);
    expect(scanEmitted('x', JSON.stringify({ chat: 'hi BRAVO two!' }), names, 'alpha_one')).toHaveLength(1);
    expect(scanEmitted('x', JSON.stringify({ chat: 'bravotwo' }), names, 'alpha_one')).toHaveLength(0);
    const bravoAp = [...publishFixtureRaw().matchAll(/"ap":"([A-Za-z0-9+/=]+)"/g)].map((m) => m[1]!).find((ap) => appearanceAccount(ap) === 'bravo_two')!;
    expect(scanEmitted('x', JSON.stringify({ ap: bravoAp }), names, 'alpha_one')).toHaveLength(1);
    const hits = scanEmitted('x', JSON.stringify({ path: '/Users/someone/x' }), names, 'alpha_one');
    expect(hits).toEqual([{ where: 'x:1', what: 'home directory path' }]);
  });

  test('a slot alias is not a hit on an all-digit account name; other text with that number is', () => {
    const names = new Set(['1104']);
    expect(scanEmitted('x', JSON.stringify({ p: [[1104, 'slot_1104', 0, 0, 0, 3]] }), names, 'alpha_one')).toEqual([]);
    expect(scanEmitted('x', JSON.stringify({ appearance: { name: 'Slot 1104' } }), names, 'alpha_one')).toEqual([]);
    expect(scanEmitted('x', JSON.stringify({ chatMessage: 'Hello 1104!' }), names, 'alpha_one')).toHaveLength(1);
  });

  test('fails closed without the scored account', () => {
    expect(() => new Redactor(undefined)).toThrow(RedactionError);
    expect(() => new Redactor('  ')).toThrow(RedactionError);
  });
});

// A clip that follows another account than the record one (attempt 4's death): the fixture's
// Bravo Two stands in for that account.
describe('redaction while following another account', () => {
  const { redactor, chunks } = publishFixture('Bravo Two');
  const all = chunks.join('');

  test('the followed account is redacted like everyone else, and the scan looks for it', () => {
    expect(redactor.followed).toBe('bravo_two');
    expect(redactor.names).toEqual(new Set(['bravo_two']));
    expect(all).not.toMatch(/bravo/i);
    expect(redactor.counts.rosterNamesReplaced).toBe(12);
    expect(redactor.counts.appearanceNamesReplaced).toBe(1);
    for (const [i, chunk] of chunks.entries()) {
      expect(scanEmitted(`chunk-${i}`, chunk, redactor.names, redactor.scored)).toEqual([]);
    }
  });

  test('its slot is tracked, so the camera can follow the slot alias the frames carry', () => {
    expect(redactor.followSlotsBetween(0, Number.MAX_SAFE_INTEGER)).toEqual([2]);
    expect(redactor.followSlot).toBe(2);
    expect(all).toContain(`"${slotName(2)}"`);
    const aps = [...all.matchAll(/"ap":"([A-Za-z0-9+/=]+)"/g)].map((m) => appearanceAccount(m[1]!));
    expect(aps).toContain(slotName(2));
  });

  test('the scored account is still the only one named', () => {
    expect(all).toContain('"Alpha One"');
    const named = new Set([...all.matchAll(/"ap":"([A-Za-z0-9+/=]+)"/g)].map((m) => appearanceAccount(m[1]!)));
    expect(named).toEqual(new Set(['alpha_one', 'slot_2']));
  });

  test('an account never seen is scanned for anyway', () => {
    const unseen = new Redactor(SCORED, 'Charlie Three');
    expect(unseen.names).toEqual(new Set(['charlie_three']));
    expect(scanEmitted('x', JSON.stringify({ chat: 'charlie three' }), unseen.names, unseen.scored)).toHaveLength(1);
  });

  test('fails closed on an empty followed account, or the scored one under another spelling', () => {
    expect(() => new Redactor(SCORED, '')).toThrow(RedactionError);
    expect(() => new Redactor(SCORED, '  ')).toThrow(RedactionError);
    expect(() => new Redactor(SCORED, 'alpha_one')).toThrow(RedactionError);
    expect(() => new Redactor(SCORED, ' ALPHA  one ')).toThrow(RedactionError);
  });
});

describe('the clip table', () => {
  const seconds = (id: string) => (Date.parse(CLIPS[id]!.window.to) - Date.parse(CLIPS[id]!.window.from)) / 1000;

  test('both death windows are 10 to 15 s, and hold a death and its respawn', () => {
    for (const id of ['spider-death', 'attempt-4-death']) {
      expect(seconds(id)).toBeGreaterThanOrEqual(10);
      expect(seconds(id)).toBeLessThanOrEqual(15);
      expect(CLIPS[id]!.death).toBeDefined();
    }
  });

  test('the spiders follow the record account; the Grand Tree follows attempt 4 by its slot', () => {
    expect(CLIPS['spider-death']!.follow).toBe('record');
    expect(CLIPS['attempt-4-death']!.follow).toBe('env');
  });

  test('every mark falls inside its window', () => {
    for (const clip of Object.values(CLIPS)) {
      for (const mark of clip.marks) {
        expect(Date.parse(mark.at)).toBeGreaterThanOrEqual(Date.parse(clip.window.from));
        expect(Date.parse(mark.at)).toBeLessThanOrEqual(Date.parse(clip.window.to));
      }
    }
  });
});

function publishFixtureRaw(): string {
  return fixtureFrames().map(formatFrameLine).join('\n');
}
