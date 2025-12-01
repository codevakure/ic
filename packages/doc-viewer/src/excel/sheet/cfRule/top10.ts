import {CT_CfRule} from '../../../openxml/ExcelTypes';
import {gt, gte, lt, lte} from '../../../util/number';
import {toNumber} from '../../data/toNumber';
import {CellInfo} from '../../types/CellInfo';
import {RangeRef} from '../../types/RangeRef';
import {Sheet} from '../Sheet';
import {applyCfRuleDxf} from './applyCfRuleDxf';

export function getRankValue(
  values: number[],
  cfRule: CT_CfRule
): number | null {
  if (values.length === 0) {
    return null;
  }

  // [comment removed]
  values.sort((a, b) => {
    if (lt(a, b)) {
      return -1;
    }
    if (gt(a, b)) {
      return 1;
    }
    return 0;
  });

  let top10Number = cfRule.rank || 10;
  if (cfRule.percent) {
    top10Number = Math.ceil(values.length * (top10Number / 100));
  }

  top10Number = Math.max(Math.min(top10Number, values.length), 1);

  // [comment removed]
  if (cfRule.bottom) {
    return values[top10Number - 1];
  } else {
    return values[values.length - top10Number];
  }
}

/**
 */

export function top10(
  sheet: Sheet,
  cellInfo: CellInfo,
  ranges: RangeRef[],
  cfRule: CT_CfRule
): boolean {
  const rangeCache = sheet.getRangeCache();
  const ruleKey = JSON.stringify(cfRule);
  let rankValue = rangeCache.get(ranges, ruleKey);
  if (!rankValue) {
    const rangeValues = sheet.getCellValueByRanges(ranges);
    if (rangeValues.length === 0) {
      return false;
    }
    const values: number[] = [];
    rangeValues.map(value => {
      if (value.text === '') {
        return;
      }
      values.push(toNumber(value.value));
    });
    rankValue = getRankValue(values, cfRule);

    if (rankValue === null) {
      return false;
    }
    rangeCache.set(ranges, ruleKey, rankValue);
  }

  const value = parseFloat(cellInfo.value);

  if (cfRule.bottom) {
    if (lte(value, rankValue)) {
      applyCfRuleDxf(cfRule, sheet, cellInfo);
      return true;
    }
  } else {
    if (gte(value, rankValue)) {
      applyCfRuleDxf(cfRule, sheet, cellInfo);
      return true;
    }
  }

  return false;
}
