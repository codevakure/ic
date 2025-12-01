import { test,expect } from 'vitest';
import {RangeRef} from '../../../types/RangeRef';
import {calcTableRelativePosition} from '../calcTableRelativePosition';

// [comment removed]
// [comment removed]

const range: RangeRef = {
  startRow: 0,
  startCol: 0,
  endRow: 9,
  endCol: 9
};

const isRowHidden = (rowIndex: number) => rowIndex === 2;

const isColHidden = (colIndex: number) => colIndex === 2;

const headerRowCount = 1;

const totalsRowCount = 1;

const totalsRowShown = true;

test('header', () => {
  // [comment removed]
  expect(
    calcTableRelativePosition(
      range,
      isRowHidden,
      isColHidden,
      0,
      0,
      headerRowCount,
      totalsRowCount,
      totalsRowShown
    )
  ).toEqual({
    rowType: 'header',
    colType: 'odd',
    rowPosition: 'header',
    colPosition: 'first'
  });
});

test('without header', () => {
  // [comment removed]
  expect(
    calcTableRelativePosition(
      range,
      isRowHidden,
      isColHidden,
      0,
      0,
      0,
      totalsRowCount,
      totalsRowShown
    )
  ).toEqual({
    rowType: 'odd',
    colType: 'odd',
    rowPosition: 'first',
    colPosition: 'first'
  });
});

test('firstRow', () => {
  // [comment removed]
  expect(
    calcTableRelativePosition(
      range,
      isRowHidden,
      isColHidden,
      1,
      0,
      headerRowCount,
      totalsRowCount,
      totalsRowShown
    )
  ).toEqual({
    colPosition: 'first',
    colType: 'odd',
    rowPosition: 'first',
    rowType: 'odd'
  });
});

test('row two', () => {
  // [comment removed]
  expect(
    calcTableRelativePosition(
      range,
      isRowHidden,
      isColHidden,
      3,
      0,
      headerRowCount,
      totalsRowCount,
      totalsRowShown
    )
  ).toEqual({
    colPosition: 'first',
    colType: 'odd',
    rowPosition: 'middle',
    rowType: 'even'
  });
});

test('odd', () => {
  // [comment removed]
  expect(
    calcTableRelativePosition(
      range,
      isRowHidden,
      isColHidden,
      2,
      0,
      headerRowCount,
      totalsRowCount,
      totalsRowShown
    )
  ).toEqual({
    rowType: 'odd',
    rowPosition: 'first',
    colType: 'odd',
    colPosition: 'first'
  });
});

test('event', () => {
  // [comment removed]
  expect(
    calcTableRelativePosition(
      range,
      isRowHidden,
      isColHidden,
      5,
      0,
      headerRowCount,
      totalsRowCount,
      totalsRowShown
    )
  ).toEqual({
    colPosition: 'first',
    colType: 'odd',
    rowType: 'even',
    rowPosition: 'middle'
  });
});

test('last row', () => {
  // [comment removed]
  expect(
    calcTableRelativePosition(
      range,
      isRowHidden,
      isColHidden,
      8,
      0,
      headerRowCount,
      totalsRowCount,
      totalsRowShown
    )
  ).toEqual({
    colPosition: 'first',
    colType: 'odd',
    rowPosition: 'last',
    rowType: 'odd'
  });
});
