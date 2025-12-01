/**
 */

import Word from '../../Word';
import {BookmarkStart} from './Bookmark';
import {Hyperlink} from './Hyperlink';
import {Run} from './Run';

type InlineChild = Run | BookmarkStart | Hyperlink;

export class InlineText {
  children: InlineChild[] = [];

  addChild(child: InlineChild) {
    this.children.push(child);
  }

  static fromXML(word: Word, element: Element): InlineText {
    const smartTag = new InlineText();

    for (let i = 0; i < (element.children || []).length; i++) {
      const child = (element.children || [])[i] as Element;
      const tagName = child.tagName;
      switch (tagName) {
        case 'w:r':
          smartTag.addChild(Run.fromXML(word, child));
          break;

        case 'w:hyperlink':
          smartTag.addChild(Hyperlink.fromXML(word, child));
          break;

        case 'w:bookmarkStart':
          smartTag.addChild(BookmarkStart.fromXML(word, child));

        case 'w:bookmarkEnd':
          // [comment removed]
          break;

        case 'w:proofErr':
        case 'w:noProof':
          // [comment removed]
          break;

        case 'w:smartTagPr':
          // [comment removed]
          break;

        case 'w:del':
          // [comment removed]
          break;

        default:
          console.warn('parse Inline: Unknown key', tagName, child);
      }
    }

    return smartTag;
  }
}
