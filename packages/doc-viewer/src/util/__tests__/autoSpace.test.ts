import { test, expect } from 'vitest';
import { cjkspace } from '../autoSpace';

test('autoSpace with no CJK characters', async () => {
  // Without CJK characters, no spaces should be added
  expect(cjkspace('abc'.split(''))).toBe('abc');
});

test('autoSpace preserves existing spacing', async () => {
  expect(cjkspace('hello world'.split(''))).toBe('hello world');
});
