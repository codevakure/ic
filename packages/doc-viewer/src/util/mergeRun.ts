/**
 */

import {parsePr} from '../word/parse/parsePr';
import Word from '../Word';

/**
 */
function hasSomeStyle(
  word: Word,
  first: Element | null,
  second: Element | null
) {
  const firstStyle = first ? parsePr(word, first, 'r') : {};
  const secondStyle = second ? parsePr(word, second, 'r') : {};
  return JSON.stringify(firstStyle) === JSON.stringify(secondStyle);
}

/**
 */
function hasTSpace(element: Element) {
  const t = element.getElementsByTagName('w:t')[0];
  if (t) {
    return t.getAttribute('xml:space') === 'preserve';
  }
  return false;
}

function mergeText(first: Element, second: Element) {
  const firstT = first.getElementsByTagName('w:t')[0];
  const secondT = second.getElementsByTagName('w:t')[0];
  if (firstT && secondT) {
    let secondText = secondT.textContent || '';
    firstT.textContent += secondText || '';
  }
}

/**
 */
export function canMerge(element: Element) {
  const tagName = element.tagName;

  const childChildren = element.children;

  let hasText = false;
  let textHasSpace = false;
  for (let i = 0; i < (childChildren || []).length; i++) {
    const childChild = (childChildren || [])[i] as Element;
    if (childChild.tagName === 'w:t') {
      hasText = true;
      textHasSpace = childChild.getAttribute('xml:space') === 'preserve';
      if (textHasSpace) {
        break;
      }
    }
    // [comment removed]
    if (childChild.tagName === 'w:tab') {
      return false;
    }
  }
  return tagName === 'w:r' && hasText && !textHasSpace;
}

/**
 */
export function mergeRunInP(word: Word, p: Element) {
  const newElements: Element[] = [];
  let lastRun: Element | null = null;

  for (let i = 0; i < (p.children || []).length; i++) {
    const child = (p.children || [])[i] as Element;
    const tagName = child.tagName;
    // [comment removed]
    if (canMerge(child)) {
      if (lastRun) {
        const lastRunProps = lastRun.getElementsByTagName('w:rPr')[0];
        const thisProps = child.getElementsByTagName('w:rPr')[0];
        if (hasSomeStyle(word, lastRunProps, thisProps)) {
          mergeText(lastRun, child);
        } else {
          lastRun = child;
          newElements.push(child);
        }
      } else {
        // [comment removed]
        lastRun = child;
        newElements.push(child);
      }
    } else {
      // [comment removed]
      if (tagName !== 'w:proofErr') {
        lastRun = null;
        newElements.push(child);
      }
    }
  }

  p.innerHTML = '';

  for (const newElement of newElements) {
    p.appendChild(newElement);
  }
}

/**
 * @param document
 */
export function mergeRun(word: Word, doc: Document) {
  const ps = doc.getElementsByTagName('w:p');
  for (let i = 0; i < ps.length; i++) {
    const p = ps[i];
    mergeRunInP(word, p);
  }
}
