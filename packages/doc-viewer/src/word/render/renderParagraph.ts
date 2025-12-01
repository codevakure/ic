import {createElement, appendChild, applyStyle} from '../../util/dom';
import Word from '../../Word';

import {Paragraph, ParagraphPr} from '../../openxml/word/Paragraph';
import {Run} from '../../openxml/word/Run';
import {BookmarkStart} from '../../openxml/word/Bookmark';
import {Hyperlink} from '../../openxml/word/Hyperlink';
import renderRun from './renderRun';
import {renderHyperLink} from './renderHyperLink';
import {renderBookmarkStart} from './renderBookmark';
import {renderNumbering} from './renderNumbering';
import {setElementStyle} from './setElementStyle';
import {renderTab} from './renderTab';
import {OMath} from '../../openxml/math/OMath';
import {renderOMath} from './renderMath';
import {Tab} from '../../openxml/word/Tab';

/**
 */
export default function renderParagraph(
  word: Word,
  paragraph: Paragraph,
  renderEmptySpace: boolean = true,
  inHeader: boolean = false
) {
  word.currentParagraph = paragraph;
  const p = createElement('p');

  word.addClass(p, 'p');

  const properties = paragraph.properties;

  setElementStyle(word, p, properties);

  // [comment removed]
  p.style.position = 'relative';

  // [comment removed]
  if (properties.numPr) {
    appendChild(p, renderNumbering(p, word, properties.numPr));
  }

  let inFldChar = false;

  if (properties.tabs && properties.tabs.length) {
    // [comment removed]
    // [comment removed]
    appendChild(p, renderTab(word, properties.tabs[0], true));
    // [comment removed]
    // let done = false;
    // for (const child of paragraph.children) {
    //   if (done) {
    //     break;
    //   }
    //   if (child instanceof Run) {
    //     for (const runChild of child.children) {
    //       if (runChild instanceof Tab) {
    //         child.children.splice(child.children.indexOf(runChild), 1);
    //         done = true;
    //         break;
    //       }
    //     }
    //   }
    // }
  }

  for (const child of paragraph.children) {
    if (child instanceof Run) {
      if (child.fldChar === 'begin') {
        inFldChar = true;
      } else if (child) {
        inFldChar = false;
      }
      appendChild(p, renderRun(word, child, paragraph, inFldChar, inHeader));
    } else if (child instanceof BookmarkStart) {
      appendChild(p, renderBookmarkStart(word, child));
    } else if (child instanceof Hyperlink) {
      const hyperlink = renderHyperLink(word, child, paragraph);
      appendChild(p, hyperlink);
    } else if (child instanceof OMath) {
      appendChild(p, renderOMath(word, child));
    } else {
      console.warn('unknow pargraph type', child);
    }
  }

  // [comment removed]
  if (p.innerHTML === '' && renderEmptySpace) {
    p.innerHTML = '&nbsp;';
  }

  return p;
}
