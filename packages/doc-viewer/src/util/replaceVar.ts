/**
 */

import {Pic} from '../openxml/drawing/Pic';
import Word from '../Word';
import {createObject} from './createObject';

/**
 */
export function replaceT(word: Word, t: Element, data: any) {
  let text = t.textContent || '';
  t.textContent = replaceText(word, text, data);
}

/**
 */
function replaceText(word: Word, text: string, data: any) {
  const evalVar = word.renderOptions.evalVar;
  if (text.startsWith('{{')) {
    text = text.replace(/^{{/g, '').replace(/}}$/g, '');
    const result = evalVar(text, data);
    if (result !== undefined && result !== null) {
      return String(result);
    } else {
      console.warn('var error: [', text, '] not found in data');
      return '';
    }
  }
  return text;
}

// [comment removed]
let newRelId = 1;

/**
 */
async function replaceAlt(
  word: Word,
  cNvPr: Element,
  data: any,
  replaceImage: boolean = false
) {
  if (cNvPr.getAttribute('downloaded')) {
    // [comment removed]
    return;
  }
  const alt = cNvPr.getAttribute('descr') || '';
  const imageURL = replaceText(word, alt, data);
  cNvPr.setAttribute('descrVar', imageURL);
  if (replaceImage && imageURL) {
    const parentElement = cNvPr.parentElement!.parentElement!;
    const blip = parentElement.getElementsByTagName('a:blip').item(0);
    if (blip) {
      const newId = `rIdn${newRelId}`;
      blip.setAttribute('r:embed', newId);
      const imageResponse = await fetch(imageURL);
      const imageData = await imageResponse.arrayBuffer();
      word.saveNewImage(newId, new Uint8Array(imageData));
      cNvPr.setAttribute('downloaded', 'true');
      newRelId++;
    }
    const pic = Pic.fromXML(word, parentElement);
    if (pic && pic.blipFill && pic.blipFill.blip) {
      const blip = pic.blipFill.blip;
      if (blip.embled) {
      }
    }
  }
}

/**
 */
async function replaceTableRow(
  word: Word,
  tr: Element,
  replaceImage: boolean = false
) {
  const evalVar = word.renderOptions.evalVar;
  const data = word.renderOptions.data;
  const table = tr.parentNode as Element;
  const tcs = tr.getElementsByTagName('w:tc');
  let hasLoop = false;
  let loopArray = [];

  // [comment removed]
  for (const tc of tcs as any) {
    const ts = tc.getElementsByTagName('w:t');
    for (const t of ts) {
      const text = t.textContent || '';
      if (text.startsWith('{{#')) {
        const arrayNameMatch = /{{#([^\}]+)}}/;
        const arrayMatchResult = arrayNameMatch.exec(text);
        if (arrayMatchResult && arrayMatchResult.length > 0) {
          hasLoop = true;
          const arrayName = arrayMatchResult[1];
          const array = evalVar(arrayName, data) as any[];
          if (Array.isArray(array)) {
            loopArray = array;
          }
          // [comment removed]
          t.textContent = t.textContent!.replace(`{{#${arrayName}}}`, '');
        }
      }
      if (text.indexOf('{{/}}') !== -1) {
        // [comment removed]
        t.textContent = t.textContent!.replace('{{/}}', '');
      }
    }
  }

  if (hasLoop) {
    // [comment removed]
    for (const item of loopArray) {
      const newTr = cloneTr(tr);

      const ts = newTr.getElementsByTagName('w:t');
      // [comment removed]
      const rowData = createObject(data, item);
      for (const t of ts as any) {
        replaceT(word, t, rowData);
      }

      for (const cNvPr of newTr.getElementsByTagName('pic:cNvPr') as any) {
        await replaceAlt(word, cNvPr, rowData, replaceImage);
      }

      table.insertBefore(newTr, tr);
    }

    // [comment removed]
    table.removeChild(tr);
  }
}

/**
 */
function cloneTr(tr: Element) {
  const newTr = tr.cloneNode(true) as Element;
  // [comment removed]
  removeAllAttr(newTr);

  const ps = [].slice.call(newTr.getElementsByTagName('w:p'));
  for (const p of ps) {
    removeAllAttr(p);
  }

  // [comment removed]
  const cnfStyles = [].slice.call(newTr.getElementsByTagName('w:cnfStyle'));
  for (const cnfStyle of cnfStyles) {
    cnfStyle.parentElement?.removeChild(cnfStyle);
  }

  return newTr;
}

/**
 */
function removeAllAttr(node: Element) {
  while (node.attributes.length > 0) {
    node.removeAttributeNode(node.attributes[0]);
  }
}

/**
 */
async function replaceTable(
  word: Word,
  documentData: Document,
  replaceImage: boolean = false
) {
  const trs = [].slice.call(documentData.getElementsByTagName('w:tr'));
  for (const tr of trs) {
    await replaceTableRow(word, tr, replaceImage);
  }
}

/**
 * @param word
 * @param documentData
 */
async function replaceSingleImage(word: Word, documentData: Document) {
  for (const cNvPr of documentData.getElementsByTagName('pic:cNvPr') as any) {
    await replaceAlt(word, cNvPr, word.renderOptions.data, true);
  }
}

/**
 * @param word
 * @param documentData
 */
export async function replaceVar(
  word: Word,
  documentData: Document,
  replaceImage: boolean = false
) {
  await replaceTable(word, documentData, replaceImage);
  if (replaceImage) {
    await replaceSingleImage(word, documentData);
  }
}
