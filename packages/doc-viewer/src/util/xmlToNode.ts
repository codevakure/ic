import {XMLNode} from './xml';

const openBracket = '<';
const closeBracket = '>';
const slash = '/';
const space = ' ';
const questionMark = '?';

/**
 */
export function xmlToNode(xml: string): XMLNode {
  let position = 0;

  // [comment removed]
  let text = '';
  let xmlLength = xml.length;

  const nodeStack: XMLNode[] = [];

  // [comment removed]
  function processAttr() {
    const currentNode = nodeStack[nodeStack.length - 1];
    let attrName = '';
    while (position < xmlLength) {
      const char = xml[position];
      if (char === ' ') {
        position++;
        continue;
      }

      // [comment removed]
      if (char === '=') {
        // [comment removed]
        const quote = xml[position + 1];
        const endQuote = xml.indexOf(quote, position + 2);
        const attrValue = xml
          .substring(position + 2, endQuote)
          .replace(/&quot;/g, '"');
        currentNode.attrs[attrName] = attrValue;
        attrName = '';
        position = endQuote + 1;
        continue;
      }

      if (char === '/' && xml[position + 1] === '>') {
        position = position + 2;
        if (nodeStack.length > 1) {
          nodeStack.pop();
        }
        text = '';
        return;
      }

      if (char === closeBracket) {
        position++;
        return;
      }

      attrName += char;
      position++;
    }
  }

  while (position < xmlLength) {
    const char = xml[position];
    // [comment removed]
    if (char === openBracket && xml[position + 1] === questionMark) {
      const end = xml.indexOf('?>', position);
      position = end + 2;
      continue;
    }

    // [comment removed]
    if (char === openBracket) {
      // [comment removed]
      if (xml[position + 1] === slash) {
        const currentNode = nodeStack[nodeStack.length - 1];
        if (!currentNode) {
          position = position + 2;
          // [comment removed]
          console.error('xml parse error');
          continue;
        }
        currentNode.text = text
          .trim()
          .replace(/&gt;/g, '>')
          .replace(/&lt;/g, '<');
        if (nodeStack.length > 1) {
          nodeStack.pop();
        }
        const end = xml.indexOf(closeBracket, position);
        position = end + 1;
        text = '';
        continue;
      } else {
        // [comment removed]
        let tagName = '';
        position = position + 1;
        while (position < xmlLength) {
          const char = xml[position];
          if (char === space || char === closeBracket) {
            break;
          }
          tagName += char;
          position++;
        }

        const newNode = {
          tag: tagName,
          attrs: {},
          children: []
        };

        const parent = nodeStack[nodeStack.length - 1];
        if (parent) {
          parent.children.push(newNode);
        }

        nodeStack.push(newNode);

        // [comment removed]
        processAttr();

        text = '';

        continue;
      }
    }

    text += char;

    position++;

    // [comment removed]
    if (position > 124) {
      xml = xml.substring(position);
      position = 0;
      xmlLength = xml.length;
    }
  }

  return nodeStack[0]!;
}
