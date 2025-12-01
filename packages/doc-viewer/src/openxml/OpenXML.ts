/**
 * OpenXML helper functions
 * Based on document-viewer-backup implementation
 */

/**
 * Get w:val attribute value
 */
export function getVal(element: Element): string {
  return (
    element.getAttribute('w:val') ||
    element.getAttribute('w14:val') ||
    element.getAttribute('val') ||
    ''
  );
}

/**
 * Get w:val as number
 */
export function getValNumber(element: Element, defaultValue: number = 0): number {
  const val = getVal(element);
  if (!val) return defaultValue;
  const num = parseInt(val, 10);
  return isNaN(num) ? defaultValue : num;
}

/**
 * Normalize boolean value from various formats
 */
export function normalizeBoolean(
  value: string | boolean | null | undefined,
  defaultValue: boolean = false
): boolean {
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'string') {
    switch (value.toLowerCase()) {
      case '1':
      case 'on':
      case 'true':
        return true;
      case '0':
      case 'off':
      case 'false':
        return false;
    }
  }
  if (typeof value === 'number') {
    return value !== 0;
  }
  return defaultValue;
}

/**
 * Get w:val as boolean
 */
export function getValBoolean(element: Element, defaultValue: boolean = true): boolean {
  return normalizeBoolean(getVal(element), defaultValue);
}

/**
 * Get attribute as boolean
 */
export function getAttrBoolean(
  element: Element,
  attr: string,
  defaultValue: boolean = true
): boolean {
  return normalizeBoolean(element.getAttribute(attr), defaultValue);
}

/**
 * Get attribute as number
 */
export function getAttrNumber(
  element: Element,
  attr: string,
  defaultValue: number = 0
): number {
  const value = element.getAttribute(attr);
  if (!value) return defaultValue;
  const num = parseFloat(value);
  return isNaN(num) ? defaultValue : num;
}

/**
 * Get attribute as percentage (0-1)
 */
export function getAttrPercent(element: Element, attr: string, defaultValue: number = 0): number {
  const value = element.getAttribute(attr);
  if (!value) return defaultValue;
  
  // Remove % if present
  const numStr = value.replace('%', '');
  const num = parseFloat(numStr);
  
  if (isNaN(num)) return defaultValue;
  
  // If it's already 0-1, return as is
  // If it's > 1, assume it's percentage and divide by 100
  return num > 1 ? num / 100 : num;
}

/**
 * Get child element by tag name
 */
export function getChild(parent: Element, tagName: string): Element | null {
  for (let i = 0; i < parent.children.length; i++) {
    const child = parent.children[i];
    if (!child) continue;
    const childTag = child.tagName || child.nodeName;
    if (childTag === tagName || childTag === `w:${tagName}` || childTag === `a:${tagName}`) {
      return child;
    }
  }
  return null;
}

/**
 * Get all children by tag name
 */
export function getChildren(parent: Element, tagName: string): Element[] {
  const results: Element[] = [];
  for (let i = 0; i < parent.children.length; i++) {
    const child = parent.children[i];
    if (!child) continue;
    const childTag = child.tagName || child.nodeName;
    if (childTag === tagName || childTag === `w:${tagName}` || childTag === `a:${tagName}`) {
      results.push(child);
    }
  }
  return results;
}

/**
 * Check if element has child with tag name
 */
export function hasChild(parent: Element, tagName: string): boolean {
  return getChild(parent, tagName) !== null;
}

/**
 * Get text content from element
 */
export function getTextContent(element: Element): string {
  return element.textContent || '';
}

/**
 * Get attribute with namespace fallback
 */
export function getAttrWithNamespace(
  element: Element,
  attrName: string,
  namespaces: string[] = ['w', 'a', 'r']
): string | null {
  // Try without namespace first
  let value = element.getAttribute(attrName);
  if (value) return value;
  
  // Try with each namespace
  for (const ns of namespaces) {
    value = element.getAttribute(`${ns}:${attrName}`);
    if (value) return value;
  }
  
  return null;
}

/**
 * Query selector with namespace support
 */
export function querySelectorNS(
  parent: Element | Document,
  selector: string
): Element | null {
  // Try with w: prefix
  let result = parent.querySelector(`w\\:${selector}, ${selector}`);
  if (result) return result;
  
  // Try with a: prefix
  result = parent.querySelector(`a\\:${selector}, ${selector}`);
  return result;
}

/**
 * Query all with namespace support
 */
export function querySelectorAllNS(
  parent: Element | Document,
  selector: string
): Element[] {
  const results: Element[] = [];
  
  // Try with w: prefix
  const wResults = parent.querySelectorAll(`w\\:${selector}, ${selector}`);
  for (let i = 0; i < wResults.length; i++) {
    const el = wResults[i];
    if (el) results.push(el);
  }
  
  // Try with a: prefix if no results
  if (results.length === 0) {
    const aResults = parent.querySelectorAll(`a\\:${selector}, ${selector}`);
    for (let i = 0; i < aResults.length; i++) {
      const el = aResults[i];
      if (el) results.push(el);
    }
  }
  
  return results;
}
