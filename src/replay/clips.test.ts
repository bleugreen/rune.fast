import { expect, test } from 'bun:test';
import { FINISH } from './clips';

test('the finish marks are the timeline events, ticks as the timeline numbers them', () => {
  expect(FINISH.marks.map((m) => [m.label, m.sessionTick])).toEqual([
    ['Login', 1],
    ['Agility 99', 6095],
  ]);
  expect(FINISH.marks[1]!.event.type).toBe('result');
  expect(FINISH.marks[0]!.event.type).toBe('recovery');
});
