import {createElement} from '../../util/dom';
import Word, {WordRenderOptions} from '../../Word';
import renderBody from './renderBody';

import {WDocument} from '../../openxml/word/WDocument';

/**
 * http://webapp.docx4java.org/OnlineDemo/ecma376/WordML/document.html
 */
export default function renderDocument(
  root: HTMLElement,
  word: Word,
  wDocument: WDocument,
  renderOptions: WordRenderOptions
) {
  const doc = createElement('article');
  renderBody(root, word, doc, wDocument, wDocument.body, renderOptions);
  return doc;
}
