import {NumberPr} from '../../openxml/word/numbering/NumberProperties';
import {createElement} from '../../util/dom';
import Word from '../../Word';
import {ST_NumberFormat} from '../../openxml/Types';
import {setElementStyle} from './setElementStyle';

/**
 */
function romanize(num: number) {
  let lookup = {
    M: 1000,
    CM: 900,
    D: 500,
    CD: 400,
    C: 100,
    XC: 90,
    L: 50,
    XL: 40,
    X: 10,
    IX: 9,
    V: 5,
    IV: 4,
    I: 1
  } as {[key: string]: number};
  let roman = '';
  for (let key in lookup) {
    while (num >= lookup[key]) {
      roman += key;
      num -= lookup[key];
    }
  }
  return roman;
}

/**
 */
function convertNumToFormat(numFmt: ST_NumberFormat, num: number): string {
  switch (numFmt) {
    case 'decimal':
      return num.toString();

    case 'lowerLetter':
      return String.fromCharCode(96 + num);

    case 'upperLetter':
      return String.fromCharCode(64 + num);

    case 'lowerRoman':
      return romanize(num).toLowerCase();

    case 'upperRoman':
      return romanize(num).toUpperCase();

    case 'bullet':
      // [comment removed]
      return '&bull;';

    default:
      return num.toString();
  }
}

/**
 */
export function renderNumbering(
  p: HTMLElement,
  word: Word,
  numPr: NumberPr
): HTMLElement | null {
  const numbering = word.numbering;
  const numId = numPr.numId;
  if (!numId) {
    console.warn('renderNumbering: numId is empty');
    return null;
  }

  if (!numbering) {
    console.warn('renderNumbering: numbering is empty');
    return null;
  }

  const num = numbering.nums[numId];

  if (!num) {
    console.warn('renderNumbering: num is empty');
    return null;
  }

  const abstractNum = numbering.abstractNums[num.abstractNumId];

  let lvls = abstractNum.lvls;

  if (num.lvlOverride) {
    lvls = {...lvls, ...num.lvlOverride.lvls};
  }

  const lvl = lvls[numPr.ilvl];

  if (!lvl) {
    console.warn('renderNumbering: lvl is empty');
    return null;
  }

  const ilvl = numPr.ilvl;

  const ilvlData = numbering.numData[numId];

  // [comment removed]
  if (!ilvlData[ilvl]) {
    ilvlData[ilvl] = lvl.start;
  } else {
    ilvlData[ilvl] += 1;
    // [comment removed]
    for (const ilvIndex in ilvlData) {
      if (parseInt(ilvIndex) > parseInt(ilvl)) {
        ilvlData[ilvIndex] = 0;
      }
    }
  }

  const element = createElement('span');

  let lvlText = lvl.lvlText;

  // [comment removed]
  let level = parseInt(ilvl);
  // [comment removed]
  const levelNums = [];
  for (let i = 0; i <= level; i++) {
    const listNumber = ilvlData[i];
    if (listNumber) {
      const numFmt = lvls[i].numFmt;
      let numText = convertNumToFormat(numFmt, listNumber);
      // [comment removed]
      // http://officeopenxml.com/WPnumbering-isLgl.php
      if (lvl.isLgl) {
        numText = String(listNumber);
      }
      levelNums.push(numText);
    }
  }

  for (let i = 0; i < levelNums.length; i++) {
    const levelNum = levelNums[i];
    lvlText = lvlText.replace(`%${i + 1}`, levelNum);
  }

  // [comment removed]
  // http://webapp.docx4java.org/OnlineDemo/ecma376/WordML/pPr_6.html
  // This element specifies the paragraph properties which shall be applied as part of a given numbering level within the parent numbering definition.
  setElementStyle(word, p, lvl.pPr);

  setElementStyle(word, element, lvl.rPr);

  // [comment removed]

  // [comment removed]
  // http://officeopenxml.com/WPnumbering-imagesAsSymbol.php
  if (lvl.numFmt !== 'bullet' || word.renderOptions.bulletUseFont) {
    element.innerText = lvlText;
  } else {
    // [comment removed]
    // [comment removed]
    let bulletText = '&bull;';
    const unicodeString = lvlText.charCodeAt(0).toString(16).padStart(4, '0');
    if (unicodeString === 'f06e') {
      bulletText = '&#9632;';
    } else if (unicodeString === 'f075') {
      bulletText = '&#9670;';
    } else if (unicodeString === 'f0d8') {
      bulletText = '&#9658;';
    }

    element.innerHTML = bulletText;
  }

  if (lvl.suff === 'space') {
    element.innerHTML += ' ';
  } else if (lvl.suff === 'tab') {
    element.innerHTML += '&emsp;';
  }

  return element;
}
