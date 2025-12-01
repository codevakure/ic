import { test, expect } from 'vitest';
import { tokenizer } from '../cell/tokenizer';

test('wordspace', () => {
  expect(tokenizer('hello world')).toEqual([
    { t: 'hello', type: 'w' },
    { t: ' ', type: 's' },
    { t: 'world', type: 'w' }
  ]);
});

test('simple word', () => {
  expect(tokenizer('helloworld')).toEqual([
    { t: 'helloworld', type: 'w' }
  ]);
});

test('word with number', () => {
  expect(tokenizer('hello 123world')).toEqual([
    { t: 'hello', type: 'w' },
    { t: ' ', type: 's' },
    { t: '123world', type: 'w' }
  ]);
});

test('linebreak', () => {
  expect(tokenizer('he\nllo')).toEqual([
    { t: 'he', type: 'w' },
    { t: '\n', type: 'br' },
    { t: 'llo', type: 'w' }
  ]);
});

test('plural', () => {
  expect(tokenizer("let's try")).toEqual([
    { t: "let's", type: 'w' },
    { t: ' ', type: 's' },
    { t: 'try', type: 'w' }
  ]);
});

test('dash', () => {
  expect(tokenizer('hello-world')).toEqual([
    { t: 'hello', type: 'w' },
    { t: '-', type: 'h' },
    { t: 'world', type: 'w' }
  ]);
});
