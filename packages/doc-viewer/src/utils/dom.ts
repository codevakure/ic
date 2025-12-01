/**
 * DOM utility functions
 */

/**
 * Create element with optional class and attributes
 */
export function createElement<K extends keyof HTMLElementTagNameMap>(
  tagName: K,
  className?: string,
  attributes?: Record<string, string>
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tagName);
  
  if (className) {
    element.className = className;
  }
  
  if (attributes) {
    for (const [key, value] of Object.entries(attributes)) {
      element.setAttribute(key, value);
    }
  }
  
  return element;
}

/**
 * Append child to parent
 */
export function appendChild(
  parent: HTMLElement,
  child: HTMLElement | Text | string
): void {
  if (typeof child === 'string') {
    parent.appendChild(document.createTextNode(child));
  } else {
    parent.appendChild(child);
  }
}

/**
 * Append multiple children
 */
export function appendChildren(
  parent: HTMLElement,
  children: Array<HTMLElement | Text | string>
): void {
  for (const child of children) {
    appendChild(parent, child);
  }
}

/**
 * Set CSS styles on element
 */
export function setStyle(
  element: HTMLElement,
  styles: Partial<CSSStyleDeclaration> | Record<string, string | number>
): void {
  for (const [key, value] of Object.entries(styles)) {
    if (value !== undefined && value !== null) {
      (element.style as any)[key] = typeof value === 'number' ? `${value}px` : value;
    }
  }
}

/**
 * Apply CSS style object to element
 */
export function applyCSSStyle(element: HTMLElement, cssStyle: Record<string, any>): void {
  for (const [key, value] of Object.entries(cssStyle)) {
    if (value !== undefined && value !== null) {
      // Convert camelCase to kebab-case for CSS properties
      const cssKey = key.replace(/([A-Z])/g, '-$1').toLowerCase();
      element.style.setProperty(cssKey, String(value));
    }
  }
}

/**
 * Create text node
 */
export function createTextNode(text: string): Text {
  return document.createTextNode(text);
}

/**
 * Remove all children from element
 */
export function clearElement(element: HTMLElement): void {
  while (element.firstChild) {
    element.removeChild(element.firstChild);
  }
}

/**
 * Get attribute value with default
 */
export function getAttr(
  element: Element,
  name: string,
  defaultValue: string = ''
): string {
  return element.getAttribute(name) || defaultValue;
}

/**
 * Get attribute as number
 */
export function getAttrNumber(
  element: Element,
  name: string,
  defaultValue: number = 0
): number {
  const value = element.getAttribute(name);
  if (!value) return defaultValue;
  const num = parseFloat(value);
  return isNaN(num) ? defaultValue : num;
}

/**
 * Get attribute as boolean
 */
export function getAttrBoolean(
  element: Element,
  name: string,
  defaultValue: boolean = false
): boolean {
  const value = element.getAttribute(name);
  if (!value) return defaultValue;
  return value === '1' || value === 'true' || value === 'on';
}

/**
 * Query selector with type safety
 */
export function querySelector<T extends Element = Element>(
  parent: Element | Document,
  selector: string
): T | null {
  return parent.querySelector<T>(selector);
}

/**
 * Query all with type safety and array return
 */
export function querySelectorAll<T extends Element = Element>(
  parent: Element | Document,
  selector: string
): T[] {
  const nodeList = parent.querySelectorAll<T>(selector);
  return Array.from(nodeList);
}

/**
 * Get child elements (not all children nodes)
 */
export function getChildElements(parent: Element): Element[] {
  const children: Element[] = [];
  for (let i = 0; i < parent.children.length; i++) {
    const child = parent.children[i];
    if (child) children.push(child);
  }
  return children;
}

/**
 * Find first child element by tag name
 */
export function getFirstChildByTag(
  parent: Element,
  tagName: string
): Element | null {
  for (let i = 0; i < parent.children.length; i++) {
    const child = parent.children[i];
    if (child && child.tagName === tagName) {
      return child;
    }
  }
  return null;
}

/**
 * Get all children by tag name
 */
export function getChildrenByTag(
  parent: Element,
  tagName: string
): Element[] {
  const result: Element[] = [];
  for (let i = 0; i < parent.children.length; i++) {
    const child = parent.children[i];
    if (child && child.tagName === tagName) {
      result.push(child);
    }
  }
  return result;
}

/**
 * Check if element has attribute
 */
export function hasAttr(element: Element, name: string): boolean {
  return element.hasAttribute(name);
}

/**
 * Set multiple attributes
 */
export function setAttrs(
  element: Element,
  attrs: Record<string, string | number | boolean>
): void {
  for (const [key, value] of Object.entries(attrs)) {
    element.setAttribute(key, String(value));
  }
}
