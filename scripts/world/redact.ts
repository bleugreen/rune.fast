/**
 * Build-time redaction of recorded world-feed frames, before they are simulated or published.
 * Every player name becomes its slot ("slot_1167", shown as "Slot 1167") except the scored
 * account's; players' chat and overhead text are dropped; NPC overhead text that names any
 * player is dropped. Checkpoints are simulated from redacted frames, so they inherit it.
 *
 * Errors and reports carry counts, slots and positions, never a name or a payload.
 */
import { canonicalAccountName } from '@rune/world/live/accountName';
import {
  base37ToName,
  nameToBase37,
  readAppearanceName,
  toDisplayName,
  writeAppearanceName,
} from '@rune/world/live/PlayerAppearance';
import type { FeedEntity, FeedMessage, RosterPlayer } from '@rune/world/live/protocol';
import { findForbidden } from '../forbidden';

export class RedactionError extends Error {}

export function slotName(slot: number): string {
  return `slot_${slot}`;
}

const SLOT_ALIAS = /^slot_\d+$/;

function fromBase64(b64: string): Uint8Array {
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

function toBase64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes));
}

/** The canonical account name inside an appearance block. */
export function appearanceAccount(ap: string): string {
  return canonicalAccountName(toDisplayName(base37ToName(readAppearanceName(fromBase64(ap)))));
}

/** Text folded the way names are matched: lowercase, every run of non-alphanumerics one underscore. */
function tokens(text: string): string[] {
  return text.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
}

/** True if any run of whole words in `text` spells one of `names` (canonical, underscore-joined). */
export function mentionsAny(text: string, names: ReadonlySet<string>, maxWords = 6): boolean {
  const words = tokens(text);
  for (let i = 0; i < words.length; i++) {
    let candidate = '';
    for (let j = i; j < Math.min(words.length, i + maxWords); j++) {
      candidate = candidate ? `${candidate}_${words[j]}` : words[j]!;
      if (names.has(candidate)) return true;
    }
  }
  return false;
}

export type RedactionCounts = {
  rosterNamesReplaced: number;
  appearanceNamesReplaced: number;
  playerTextDropped: number;
  npcTextDropped: number;
};

export class Redactor {
  readonly scored: string;
  /** Canonical names of every other account seen, in memory only, for the scan. */
  readonly names = new Set<string>();
  /** Roster ticks at which the scored account was listed, by slot. */
  readonly scoredSightings = new Map<number, number[]>();
  readonly counts: RedactionCounts = {
    rosterNamesReplaced: 0,
    appearanceNamesReplaced: 0,
    playerTextDropped: 0,
    npcTextDropped: 0,
  };

  constructor(scoredAccount: string | undefined) {
    if (!scoredAccount || !scoredAccount.trim()) {
      throw new RedactionError('the scored account name is required (RUNE_SCORED_ACCOUNT)');
    }
    this.scored = canonicalAccountName(scoredAccount);
  }

  redact(msg: FeedMessage): FeedMessage {
    if (msg.t === 'roster') {
      return { ...msg, p: msg.p.map((entry) => this.rosterEntry(entry, msg.k)) };
    }
    if (msg.t === 'tick') {
      const out = { ...msg };
      if (msg.p) out.p = msg.p.map((r) => this.player(r));
      if (msg.n) out.n = msg.n.map((r) => this.npc(r));
      return out;
    }
    return msg;
  }

  /** Distinct slots the scored account held in rosters between ticks k0 and k1 inclusive. */
  scoredSlotsBetween(k0: number, k1: number): number[] {
    return [...this.scoredSightings].filter(([, ks]) => ks.some((k) => k >= k0 && k <= k1)).map(([slot]) => slot);
  }

  private rosterEntry(entry: RosterPlayer, k: number): RosterPlayer {
    const [slot, name] = entry;
    const canonical = canonicalAccountName(name);
    if (canonical === this.scored) {
      const ks = this.scoredSightings.get(slot) ?? [];
      ks.push(k);
      this.scoredSightings.set(slot, ks);
      return entry;
    }
    this.names.add(canonical);
    this.counts.rosterNamesReplaced++;
    return [slot, slotName(slot), entry[2], entry[3], entry[4], entry[5]];
  }

  private player(record: FeedEntity): FeedEntity {
    const out: FeedEntity = { ...record };
    if (record.ap) {
      const block = fromBase64(record.ap);
      const account = canonicalAccountName(toDisplayName(base37ToName(readAppearanceName(block))));
      if (account !== this.scored) {
        if (account !== 'invalid_name') this.names.add(account);
        writeAppearanceName(block, nameToBase37(slotName(record.i)));
        out.ap = toBase64(block);
        this.counts.appearanceNamesReplaced++;
      }
    }
    if ('ch' in out || 'cc' in out || 'sy' in out) {
      delete out.ch;
      delete out.cc;
      delete out.sy;
      this.counts.playerTextDropped++;
    }
    return out;
  }

  private npc(record: FeedEntity): FeedEntity {
    if (record.sy === undefined) return record;
    // Random-event NPCs address players by name; any name at all, the scored one included.
    if (!mentionsAny(record.sy, this.names) && !mentionsAny(record.sy, new Set([this.scored]))) return record;
    const out = { ...record };
    delete out.sy;
    this.counts.npcTextDropped++;
    return out;
  }
}

export type ScanHit = { where: string; what: string };

/**
 * Scans emitted JSON (one document, or JSONL) for any name in `names` and for the site's
 * forbidden identifiers. Every string is checked by whole words, case- and separator-blind;
 * every appearance block is decoded and its name must be the scored account's or a slot alias.
 * Hits say where (`file:line path`) and what kind, never the value.
 */
export function scanEmitted(
  label: string,
  text: string,
  names: ReadonlySet<string>,
  scored: string,
): ScanHit[] {
  const hits: ScanHit[] = [];
  const lines = text.split('\n');
  lines.forEach((line, i) => {
    if (!line) return;
    const where = `${label}:${i + 1}`;
    const blanked = line.replace(/"ap":"[A-Za-z0-9+/=]*"/g, '"ap":""');
    const forbidden = findForbidden(blanked);
    if (forbidden) hits.push({ where, what: forbidden.what });
    walk(JSON.parse(line), '', (path, key, value) => {
      if (key === 'ap') {
        const account = appearanceAccount(value);
        if (account !== scored && !SLOT_ALIAS.test(account)) hits.push({ where: `${where} ${path}`, what: 'appearance name' });
      } else if (key !== 't' && mentionsAny(value, names)) {
        hits.push({ where: `${where} ${path}`, what: 'player name' });
      }
    });
  });
  return hits;
}

function walk(value: unknown, path: string, visit: (path: string, key: string, value: string) => void, key = ''): void {
  if (typeof value === 'string') visit(path, key, value);
  else if (Array.isArray(value)) value.forEach((v, i) => walk(v, `${path}[${i}]`, visit, key));
  else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) walk(v, `${path}.${k}`, visit, k);
  }
}
