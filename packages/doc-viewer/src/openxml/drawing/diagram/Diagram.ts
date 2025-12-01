/**
 */

import Word from '../../../Word';

export class Diagram {
  // [comment removed]
  static fromXML(word: Word, relidsElement: Element) {
    const diagram = new Diagram();
    const dmId = relidsElement.getAttribute('r:dm');
    if (dmId) {
      const dmRel = word.getDocumentRels(dmId);
      if (dmRel) {
        // [comment removed]
        const dm = word.loadWordRelXML(dmRel);
        console.log(dm);
      }
    }

    return diagram;
  }
}
