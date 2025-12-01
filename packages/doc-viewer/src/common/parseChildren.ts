import {XMLNode} from '../util/xml';

/**
 */
export function parseChildren<T>(node: XMLNode, parse: (node: XMLNode) => T): T[] {
  const result: T[] = [];
  for (let i = 0; i < (node.children || []).length; i++) {
    const child = (node.children || [])[i] as XMLNode;
    result.push(parse(child));
  }
  return result;
}
