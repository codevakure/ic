import {mergeSdt} from '../../word/parse/mergeSdt';
import {parseTable} from '../../word/parse/parseTable';
import Word from '../../Word';
import {Paragraph} from './Paragraph';
import {Section, SectionChild, SectionPr} from './Section';

/**
 * http://webapp.docx4java.org/OnlineDemo/ecma376/WordML/body.html
 */
export class Body {
  sections: Section[] = [];
  // [comment removed]
  currentSection: Section;

  constructor() {
    // [comment removed]
    this.currentSection = new Section();
    this.sections.push(this.currentSection);
  }

  addChild(child: SectionChild) {
    this.currentSection.addChild(child);
  }

  /**
   */
  addSection(properties: SectionPr) {
    this.currentSection.properties = properties;
    this.currentSection = new Section();
    this.sections.push(this.currentSection);
  }

  static fromXML(word: Word, element: Element): Body {
    const body = new Body();

    for (const child of mergeSdt(element)) {
      const tagName = child.tagName;
      switch (tagName) {
        case 'w:p':
          const paragraph = Paragraph.fromXML(word, child);
          body.addChild(paragraph);
          break;

        case 'w:tbl':
          const table = parseTable(word, child);
          body.addChild(table);
          break;

        case 'w:bookmarkStart':
        case 'w:bookmarkEnd':
          break;

        case 'w:sectPr':
          body.addSection(Section.parsePr(word, child, body));
          break;

        default:
          console.warn('Body.fromXML Unknown key', tagName, child);
      }
    }

    // [comment removed]
    body.sections = body.sections.filter(
      section => section.children.length > 0
    );
    return body;
  }
}
