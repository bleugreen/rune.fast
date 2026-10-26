import { describe, expect, test } from 'bun:test';
import { INITIAL_GATE, gateFrame } from '@rune/world/live/FeedGate';
import { formatCheckpointLine, formatFrameLine, type ReplayFrame } from '@rune/world/replay/clip';
import { cutChunks } from '@rune/world/replay/cut';
import { ArrayFrameSource, Playhead } from '@rune/world/replay/Playhead';
import { fixtureFrames, stubController } from '../../packages/world/test/stubs';
import { RedactionError, Redactor, appearanceAccount, scanEmitted } from './redact';

// The fixture's accounts are fictional: Alpha One stands in for the scored account and may be
// published; Bravo Two stands in for everyone else and must not survive anywhere.
const SCORED = 'Alpha One';

function publishFixture() {
  const redactor = new Redactor(SCORED);
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
    expect(redactor.scoredSlotsBetween(0, Number.MAX_SAFE_INTEGER)).toEqual([1]);
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

  test('fails closed without the scored account', () => {
    expect(() => new Redactor(undefined)).toThrow(RedactionError);
    expect(() => new Redactor('  ')).toThrow(RedactionError);
  });
});

function publishFixtureRaw(): string {
  return fixtureFrames().map(formatFrameLine).join('\n');
}
