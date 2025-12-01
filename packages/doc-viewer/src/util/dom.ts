/**
 */

import {CSSStyle} from '../openxml/Style';

/**
 */
export function styleToText(style: CSSStyle = {}): string {
  let text = '';
  for (const key in style) {
    const value = style[key];
    if (value != null && value !== '') {
      text += `${key}: ${value};\n`;
    }
  }
  return text;
}

/**
 */
export function applyStyle(el: HTMLElement, style?: CSSStyle): void {
  if (!style) {
    return;
  }
  for (const key in style) {
    const value = style[key];
    if (value != null && value !== '') {
      el.style.setProperty(key, String(value));
    }
  }
}

/**
 */
export function createElement(tagName: string): HTMLElement {
  return document.createElement(tagName);
}

/**
 */
export function createSVGElement(tagName: string): SVGElement {
  return document.createElementNS('http://www.w3.org/2000/svg', tagName);
}

/**
 */
export function appendChild(parent: HTMLElement, child?: Node | null): void {
  if (parent && child) {
    parent.appendChild(child);
  }
}

/**
 */
export function removeChild(parent: HTMLElement, child?: Node | null): void {
  if (parent && child) {
    parent.removeChild(child);
  }
}

/**
 */
export function appendComment(parent: HTMLElement, comment: string): void {
  parent.appendChild(document.createComment(comment));
}

/**
 */
export function addClassName(el: HTMLElement, className: string): void {
  if (el && className) {
    el.classList.add(className);
  }
}

/**
 */
export function addClassNames(el: HTMLElement, classNames: string[]): void {
  if (el && classNames) {
    el.classList.add(...classNames);
  }
}
