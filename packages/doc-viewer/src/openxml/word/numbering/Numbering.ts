import Word from '../../../Word';
import {AbstractNum} from './AbstractNum';
import {Num} from './Num';

export class Numbering {
  abstractNums: Record<string, AbstractNum> = {};
  nums: Record<string, Num> = {};
  // [comment removed]
  // [comment removed]
  numData: Record<string, Record<string, number>> = {};

  static fromXML(word: Word, element: Document): Numbering {
    const numbering = new Numbering();

    const abstractNumElements = element.getElementsByTagName('w:abstractNum');
    for (let i = 0; i < abstractNumElements.length; i++) {
      const abstractNumElement = abstractNumElements[i];
      const abstractNum = AbstractNum.fromXML(word, abstractNumElement);
      numbering.abstractNums[abstractNum.abstractNumId] = abstractNum;
    }

    const numElements = element.getElementsByTagName('w:num');
    for (let i = 0; i < numElements.length; i++) {
      const numElement = numElements[i];
      const num = Num.fromXML(word, numElement);
      numbering.nums[num.numId] = num;
      numbering.numData[num.numId] = {};
    }

    return numbering;
  }
}
