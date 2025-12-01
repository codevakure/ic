import {CT_CfRule} from '../../../openxml/ExcelTypes';
import {presetIconSet} from '../../io/excel/preset/presetIconSet';
import {CellInfo} from '../../types/CellInfo';
import {RangeRef} from '../../types/RangeRef';
import {Sheet} from '../Sheet';
import {getMinMax} from './getMinMax';
import {IconNames} from '../../io/excel/preset/presetIcons';
import {getPercent} from '../../../util/number';

/**
 */
type RangeIconSetCache = {
  min: number;

  max: number;

  /**
   */
  icons: {
    percent: number;
    icon: IconNames;
  }[];
};

/**
 */

export function iconSet(
  sheet: Sheet,
  cellInfo: CellInfo,
  ranges: RangeRef[],
  cfRule: CT_CfRule
): boolean {
  const rangeCache = sheet.getRangeCache();
  const ruleKey = JSON.stringify(cfRule);
  let rangeIconSet = rangeCache.get(ranges, 'ruleKey');
  if (!rangeIconSet) {
    const iconSet = cfRule.iconSet;
    if (!iconSet) {
      return false;
    }
    const iconSetName = iconSet.iconSet || '3TrafficLights1';

    const cfvo = iconSet.cfvo;

    if (!cfvo) {
      console.warn('Icon set rule incomplete');
      return false;
    }

    const rangeValues = sheet.getCellValueByRanges(ranges);

    const icons: RangeIconSetCache['icons'] = [];

    let presetIcon = presetIconSet[iconSetName];

    if (!presetIcon) {
      console.warn('Unknown icon set', iconSetName);
      return false;
    }

    if (iconSet.reverse === true) {
      presetIcon = presetIcon.slice().reverse();
    }

    for (const [i, cfvoItem] of cfvo.entries()) {
      const type = cfvoItem.type;
      switch (type) {
        // [comment removed]
        case 'percentile':
        case 'percent': {
          const val = parseInt(cfvoItem.val || '50', 10);
          const percent = val / 100;
          const icon = presetIcon[i];
          if (typeof icon === 'undefined') {
            console.warn('Unknown icon', iconSetName);
            return false;
          }
          icons.push({
            percent,
            icon
          });
          break;
        }

        default:
          console.warn('unknown  cfvo type', type);
          break;
      }
      const {min, max} = getMinMax(rangeValues);

      if (min === undefined || max === undefined) {
        return false;
      }

      if (icons.length === 0) {
        console.warn('Icon set empty');
        return false;
      }

      rangeIconSet = {
        min,
        max,
        icons
      };
    }
  }

  const value = parseFloat(cellInfo.value);

  // [comment removed]
  const percent = getPercent(value, rangeIconSet.min, rangeIconSet.max);

  // [comment removed]
  let startIcon = rangeIconSet.icons[0].icon;
  for (const icon of rangeIconSet.icons) {
    if (percent <= icon.percent) {
      break;
    }
    startIcon = icon.icon;
  }

  // [comment removed]
  cellInfo.icon = startIcon;

  return true;
}
