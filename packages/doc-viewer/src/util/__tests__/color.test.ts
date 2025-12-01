import { test,expect } from 'vitest';
import {Color} from '../color';

test('lumMod', () => {
  const color = new Color('#00FF00');
  color.lumMod(0.5);
  // [comment removed]
  expect(color.toHex()).toBe('#008000');

  const color2 = new Color('#00FF00');
  color2.lumOff(-0.2);
  expect(color2.toHex()).toBe('#00CC00');
});
