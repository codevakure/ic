import {SaxesParser, SaxesTagPlain} from './saxes';

/**
 */
export function parseXML(content: string) {
  return new DOMParser().parseFromString(content, 'application/xml');
}

/**
 */
export function buildXML(doc: Node): string {
  const serializer = new XMLSerializer();
  return serializer.serializeToString(doc);
}

/**
 */
export interface XMLNode {
  /**
   */
  tag: string;
  /**
   */
  attrs: Record<string, string>;
  /**
   */
  children: XMLNode[];
  /**
   */
  text?: string;
  /**
   */
  s?: boolean;
}

/**
 */

export async function xml2json(xml: string): Promise<XMLNode> {
  const parser = new SaxesParser();
  const stack: XMLNode[] = [];

  return new Promise((resolve, reject) => {
    parser.on('error', function (e: any) {
      console.error(e);
    });
    parser.on('text', function (t: string) {
      const peak = stack[stack.length - 1];
      if (peak) {
        peak.text = t;
      }
    });
    parser.on('opentag', function (node: SaxesTagPlain) {
      stack.push({
        tag: node.name,
        attrs: node.attributes,
        children: []
      });
    });
    parser.on('closetag', function () {
      if (stack.length > 1) {
        const currentNode = stack[stack.length - 1];
        const parentNode = stack[stack.length - 2];
        parentNode.children.push(currentNode);
      }

      if (stack.length !== 1) {
        stack.pop();
      }
    });

    parser.on('end', function () {
      if (stack.length !== 1) {
        reject('xml2json error');
      }
      resolve(stack[0]);
    });

    parser.write(xml).close();
  });
}

/**
 * @returns
 */
export function getNodeByTagName(
  node: XMLNode,
  tagName: string,
  deep = false
): XMLNode | null {
  const children = node.children || [];
  for (const child of children) {
    if (child.tag === tagName) {
      return child;
    }
    if (deep) {
      const result = getNodeByTagName(child, tagName, deep);
      if (result) {
        return result;
      }
    }
  }
  return null;
}

/**
 * @returns
 */
export function getNodesByTagName(node: XMLNode, tagName: string): XMLNode[] {
  const result: XMLNode[] = [];
  for (const child of node.children) {
    if (child.tag === tagName) {
      result.push(child);
    }
    if (child.children) {
      result.push(...getNodesByTagName(child, tagName));
    }
  }

  return result;
}
