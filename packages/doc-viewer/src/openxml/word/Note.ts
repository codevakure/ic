/**
 */

import {parseTable} from '../../word/parse/parseTable';
import Word from '../../Word';
import {Paragraph} from './Paragraph';
import {Table} from './Table';

export type NoteChild = Paragraph | Table;

export class Note {
  children: NoteChild[] = [];

  addChild(child: NoteChild) {
    this.children.push(child);
  }

  static fromXML(word: Word, element: Element): Note {
    const note = new Note();
    for (let i = 0; i < (element.children || []).length; i++) {
      const child = (element.children || [])[i] as Element;
      const tagName = child.tagName;
      switch (tagName) {
        case 'w:p':
          const paragraph = Paragraph.fromXML(word, child);
          note.addChild(paragraph);
          break;

        case 'w:tbl':
          const table = parseTable(word, child);
          note.addChild(table);
          break;

        default:
          console.warn('Note.fromXML unknown tag', tagName, child);
      }
    }
    return note;
  }
}
