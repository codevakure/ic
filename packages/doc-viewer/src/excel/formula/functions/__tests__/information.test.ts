import { test,expect } from 'vitest';
import FormulaError from '../../FormulaError';
import {TestCase, buildEnv, testEvalCases} from './buildEnv';

const data = [
  ['', 1, 2, 3, 4],
  ['string', 3, 4, 5, 6],
  [undefined, undefined]
];

const env = buildEnv(data);

function runTest(testCase: TestCase) {
  testEvalCases(testCase, env);
}

test('ERROR.TYPE', () => {
  runTest({
    'ERROR.TYPE(#NULL!)': 1,
    'ERROR.TYPE(#DIV/0!)': 2,
    'ERROR.TYPE(#N/A)': 7,
    'ERROR.TYPE(#VALUE!)': 3,
    'ERROR.TYPE(#REF!)': 4,
    'ERROR.TYPE(#NUM!)': 6,
    'ERROR.TYPE(#NAME?)': 5
  });
});

test('ISBLANK', () => {
  runTest({
    // [comment removed]
    // 'ISBLANK("")': false,
    'ISBLANK(A1)': true,
    'ISBLANK(A2)': false,
    'ISBLANK(A3)': true,
    'ISBLANK(B3)': true,
    'ISBLANK({1})': false
  });
});

test('ISERR', () => {
  runTest({'ISERR(1/0)': true, 'ISERR(#DIV/0!)': true, 'ISERR(#N/A)': false});
});

test('ISERROR', () => {
  runTest({
    'ISERROR(1/0)': true,
    'ISERROR(#DIV/0!)': true,
    'ISERROR(#N/A)': true,
    'ISERROR(#VALUE!)': true,
    'ISERROR(#REF!)': true,
    'ISERROR(#NUM!)': true,
    'ISERROR(#NAME?)': true
  });
});

test('ISEVEN', () => {
  runTest({
    'ISEVEN(2)': true,
    'ISEVEN(-2)': true,
    'ISEVEN(2.5)': true,
    'ISEVEN(3)': false
  });
});

test('ISODD', () => {
  runTest({
    'ISODD(3)': true,
    'ISODD(-3)': true,
    'ISODD(2.5)': false,
    'ISODD(2)': false
  });
});

test('ISLOGICAL', () => {
  runTest({
    'ISLOGICAL(TRUE)': true,
    'ISLOGICAL(FALSE)': true,
    'ISLOGICAL("TRUE")': false
  });
});

test('ISNA', () => {
  runTest({'ISNA(#N/A)': true, 'ISNA(#NAME?)': false});
});

test('ISNONTEXT', () => {
  runTest({'ISNONTEXT(123)': true, 'ISNONTEXT("123")': false});
});

test('ISNUMBER', () => {
  runTest({'ISNUMBER(123)': true, 'ISNUMBER(A1)': false, 'ISNUMBER(B1)': true});
});

test('ISREF', () => {
  runTest({
    'ISREF(B2)': true,
    'ISREF(123)': false,
    'ISREF("A1")': false,
    'ISREF(#REF!)': false
    // 'ISREF(XYZ1)': false,
    // 'ISREF(A1:XYZ1)': false,
    // 'ISREF(XYZ1:A1)': false
  });
});

test('ISTEXT', () => {
  runTest({'ISTEXT(123)': false, 'ISTEXT("123")': true});
});

test('N', () => {
  runTest({
    'N(1)': 1,
    'N(TRUE)': 1,
    'N(FALSE)': 0,
    'N(1/0)': FormulaError.VALUE,
    'N("123")': 0
  });
});

test('NA', () => {
  runTest({'NA()': FormulaError.NA});
});

test('TYPE', () => {
  runTest({
    // [comment removed]
    'TYPE(A1)': 2,
    'TYPE(12)': 1,
    'TYPE("12")': 2,
    'TYPE("")': 2,
    'TYPE(TRUE)': 4,
    'TYPE(1/0)': 16,
    'TYPE({1;2;3})': 64
  });
});
