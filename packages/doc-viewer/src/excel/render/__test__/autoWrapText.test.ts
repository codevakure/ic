import { test,expect } from 'vitest';
import {stringToArray} from '../../../util/stringToArray';
import {FontStyle} from '../../types/FontStyle';

import {autoWrapText} from '../cell/autoWrapText';

/**
 */
const mockCtx = {
  save: () => {},
  restore: () => {},
  measureText: (text: string) => {
    const width = stringToArray(text).length * 10;
    return {
      actualBoundingBoxRight: 0,
      actualBoundingBoxLeft: width,
      width,
      actualBoundingBoxAscent: 0,
      actualBoundingBoxDescent: 10,
      fontBoundingBoxAscent: 0,
      fontBoundingBoxDescent: 12
    };
  }
} as any;

const defaultFont: FontStyle = {
  family: 'DengXian',
  size: 12,
  color: '#000000',
  b: false,
  i: false,
  u: 'none',
  strike: false,
  outline: false,
  shadow: false,
  condense: false
};

test('breakline', () => {
  expect(autoWrapText(mockCtx, 'C\nabc', 30, defaultFont)).toEqual([
    {
      maxHeight: 12,
      tokens: [
        {
          type: 'w',
          t: 'C',
          w: 10
        }
      ]
    },
    {
      maxHeight: 12,
      tokens: [
        {
          type: 'w',
          t: 'abc',
          w: 30
        }
      ]
    }
  ]);
});

test('breaklineBefore', () => {
  expect(autoWrapText(mockCtx, '\nabc', 30, defaultFont)).toEqual([
    {
      maxHeight: 12,
      tokens: []
    },
    {
      maxHeight: 12,
      tokens: [
        {
          type: 'w',
          t: 'abc',
          w: 30
        }
      ]
    }
  ]);
});

test('wrapTwoLine', () => {
  // ASCII word wrapping - 'Cabc' (4 chars * 10px = 40px) wraps at 30px width
  expect(autoWrapText(mockCtx, 'Cabc', 30, defaultFont)).toEqual([
    {
      maxHeight: 12,
      tokens: [
        {
          type: 'w',
          t: 'Cab',
          w: 30
        }
      ]
    },
    {
      maxHeight: 12,
      tokens: [
        {
          type: 'w',
          t: 'c',
          w: 10
        }
      ]
    }
  ]);
});

test('wrapTwoLineMore', () => {
  // [comment removed]
  expect(autoWrapText(mockCtx, 'abcd', 30, defaultFont)).toEqual([
    {
      maxHeight: 12,
      tokens: [
        {
          type: 'w',
          t: 'abc',
          w: 30
        }
      ]
    },
    {
      maxHeight: 12,
      tokens: [
        {
          type: 'w',
          t: 'd',
          w: 10
        }
      ]
    }
  ]);
});

test('wrapTwoLineMoreMerge', () => {
  // ASCII word wrapping - 'CabcdefN' (8 chars) wraps at 30px width
  expect(autoWrapText(mockCtx, 'CabcdefN', 30, defaultFont)).toEqual([
    {
      maxHeight: 12,
      tokens: [
        {
          type: 'w',
          t: 'Cab',
          w: 30
        }
      ]
    },
    {
      maxHeight: 12,
      tokens: [
        {
          type: 'w',
          t: 'cde',
          w: 30
        }
      ]
    },
    {
      maxHeight: 12,
      tokens: [
        {
          type: 'w',
          t: 'fN',
          w: 20
        }
      ]
    }
  ]);
});

test('richText', () => {
  // [comment removed]
  expect(
    autoWrapText(
      mockCtx,
      [
        {
          rPr: {},
          t: 'ric\n'
        },
        {
          rPr: {
            sz: 12,
            color: {
              rgb: 'FFFF0000'
            },
            rFont: 'DengXian',
            family: 3,
            charset: 134
          },
          t: 'tex'
        }
      ],
      30,
      defaultFont
    )
  ).toEqual([
    {
      maxHeight: 12,
      tokens: [
        {
          rPr: {},
          type: 'w',
          t: 'ric',
          w: 30
        }
      ]
    },
    {
      maxHeight: 12,
      tokens: [
        {
          rPr: {
            sz: 12,
            color: {
              rgb: 'FFFF0000'
            },
            rFont: 'DengXian',
            family: 3,
            charset: 134
          },
          type: 'w',
          t: 'tex',
          w: 30
        }
      ]
    }
  ]);
});
