import { expect, test } from 'bun:test';
import { MOMENTS, STEPS, momentById, stepAt, stepsIn } from './moments';

test('the steps tile the recovery in order, each from where the last ended', () => {
  expect(STEPS.map((s) => s.id)).toEqual(['R1', 'T26-27', 'S27', 'T27-17', 'S17', 'S17 logout']);
  for (let i = 1; i < STEPS.length; i++) expect(STEPS[i]!.from).toBe(STEPS[i - 1]!.to);
  expect(STEPS[STEPS.length - 1]!.to).toBe(6096);
  for (const s of STEPS) expect(s.code !== null || !!s.codeNote).toBe(true);
});

test('each moment shows what it is named for', () => {
  const rekit = momentById('rekit')!;
  expect(stepsIn(rekit.from, rekit.to).map((s) => s.id)).toEqual(['R1', 'T26-27']);
  const cannon = momentById('cannon')!;
  expect(stepAt(cannon.from)!.id).toBe('T26-27');
  expect(stepAt(cannon.to)!.id).toBe('S27');
  expect(cannon.marks.map((m) => [m.label, m.sessionTick])).toEqual([['S27', 214]]);
  const agility = momentById('agility-99')!;
  expect(agility.from <= 6095 && 6095 <= agility.to).toBe(true);
  expect(stepAt(6096)!.id).toBe('S17 logout');
  const whole = momentById('recovery')!;
  expect(whole.marks.map((m) => [m.label, m.sessionTick])).toEqual([
    ['Login', 1],
    ['Agility 99', 6095],
  ]);
  expect(whole.marks[1]!.event!.type).toBe('result');
});

test('moments are windows of the recording, short ones short', () => {
  for (const m of MOMENTS) {
    expect(m.from).toBeGreaterThanOrEqual(1);
    expect(m.to).toBeLessThanOrEqual(6096);
    expect(m.to).toBeGreaterThan(m.from);
    if (m.id !== 'recovery') expect(m.to - m.from).toBeLessThanOrEqual(60);
  }
  expect(new Set(MOMENTS.map((m) => m.id)).size).toBe(MOMENTS.length);
});

test('the code the page publishes names no helper account', () => {
  const code = STEPS.map((s) => s.code?.code ?? '').join('\n');
  expect(code).not.toMatch(/cairn_[a-z]/);
  expect(code.length).toBeGreaterThan(1000);
});
