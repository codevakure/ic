import {Properties} from '../../openxml/word/properties/Properties';
import {addClassName, addClassNames, applyStyle} from '../../util/dom';
import Word from '../../Word';

/**
 */
export function setElementStyle(
  word: Word,
  element: HTMLElement,
  properties: Properties | undefined
) {
  if (!properties) {
    return;
  }

  if (properties.cssStyle) {
    applyStyle(element, properties.cssStyle);

    // [comment removed]
    // [comment removed]
    if (properties.cssStyle['text-align'] === 'justify') {
      addClassName(element, 'justify');
    }
  }

  if (properties.pStyle) {
    addClassNames(element, word.getStyleClassName(properties.pStyle));
  }

  if (properties.rStyle) {
    addClassNames(element, word.getStyleClassName(properties.rStyle));
  }
}
