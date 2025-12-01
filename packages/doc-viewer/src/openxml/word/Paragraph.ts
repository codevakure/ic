/**
 */

import {getVal} from '../../OpenXML';
import {parsePr} from '../../word/parse/parsePr';
import Word from '../../Word';
import {BookmarkStart} from './Bookmark';
import {Hyperlink} from './Hyperlink';
import {NumberPr} from './numbering/NumberProperties';
import {Properties} from './properties/Properties';
import {Run, RunPr} from './Run';
import {Tab} from './Tab';
import {FldSimple} from './FldSimple';
import {OMath} from '../math/OMath';
import {mergeSdt} from '../../word/parse/mergeSdt';

/**
 */
export interface ParagraphPr extends Properties {
  numPr?: NumberPr;
  runPr?: RunPr;
  tabs?: Tab[];

  /**
   */
  autoSpace?: boolean;
}

export type ParagraphChild =
  | Run
  | BookmarkStart
  | Hyperlink
  | FldSimple
  | OMath;
// | SymbolRun
// | PageBreak
// | ColumnBreak
// | SequentialIdentifier
// | FootnoteReferenceRun
// | InsertedTextRun
// | DeletedTextRun
// | Math
// | SimpleField
// | SimpleMailMergeField
// | Comments
// | Comment
// | CommentRangeStart
// | CommentRangeEnd
// | CommentReference;

function parseAutoSpace(element: Element): boolean {
  const autoSpaceDE = element.getElementsByTagName('w:autoSpaceDE').item(0);
  const autoSpaceDN = element.getElementsByTagName('w:autoSpaceDN').item(0);
  return !!autoSpaceDE || !!autoSpaceDN;
}

export class Paragraph {
  // [comment removed]
  paraId?: string;
  properties: ParagraphPr = {};
  children: ParagraphChild[] = [];
  fldSimples: FldSimple[] = [];

  addChild(child: ParagraphChild) {
    this.children.push(child);
  }

  static parseParagraphPr(word: Word, element: Element): ParagraphPr {
    const cssStyle = parsePr(word, element, 'p');

    let pStyle;
    const pStyleTag = element.getElementsByTagName('w:pStyle').item(0);
    if (pStyleTag) {
      pStyle = getVal(pStyleTag);
    }

    let numPr;
    const numPrTag = element.getElementsByTagName('w:numPr').item(0);
    if (numPrTag) {
      numPr = NumberPr.fromXML(word, numPrTag);
    }

    const tabs: Tab[] = [];

    const tabElements = element.getElementsByTagName('w:tab');
    for (let i = 0; i < tabElements.length; i++) {
      const tabElement = tabElements[i];
      tabs.push(Tab.fromXML(word, tabElement));
    }

    const autoSpace = parseAutoSpace(element);

    return {cssStyle, pStyle, numPr, tabs, autoSpace};
  }

  static fromXML(word: Word, element: Element): Paragraph {
    const paragraph = new Paragraph();
    paragraph.fldSimples = [];
    paragraph.paraId = element.getAttribute('w14:paraId') || '';

    for (const child of mergeSdt(element)) {
      const tagName = child.tagName;
      switch (tagName) {
        case 'w:pPr':
          paragraph.properties = Paragraph.parseParagraphPr(word, child);
          break;

        case 'w:r':
          paragraph.addChild(Run.fromXML(word, child));
          break;

        case 'w:hyperlink':
          paragraph.addChild(Hyperlink.fromXML(word, child));
          break;

        case 'w:bookmarkStart':
          paragraph.addChild(BookmarkStart.fromXML(word, child));

        case 'w:bookmarkEnd':
          // [comment removed]
          break;

        case 'w:proofErr':
        case 'w:noProof':
          // [comment removed]
          break;

        case 'w:del':
        case 'w:moveTo':
        case 'w:moveFrom':
          // [comment removed]
          break;

        case 'w:fldSimple':
          // [comment removed]
          paragraph.fldSimples.push(FldSimple.fromXML(word, child));
          break;

        case 'm:oMathPara':
        case 'm:oMath':
          paragraph.addChild(OMath.fromXML(word, child));
          break;

        default:
          console.warn('parse Paragraph: Unknown key', tagName, child);
      }
    }

    return paragraph;
  }
}
