/**
 */

/**
 */
export function getVal(element: Element) {
  return (
    element.getAttribute('w:val') ||
    element.getAttribute('w14:val') ||
    element.getAttribute('val') ||
    ''
  );
}

/**
 */
export function getValNumber(element: Element) {
  return parseInt(getVal(element), 10);
}

/**
 * @param value
 * @returns
 */
export function normalizeBoolean(
  value: string | boolean | null,
  defaultValue: boolean = false
): boolean {
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'string') {
    switch (value) {
      case '1':
        return true;
      case '0':
        return false;
      case 'on':
        return true;
      case 'off':
        return false;
      case 'true':
        return true;
      case 'false':
        return false;
    }
    if (typeof value === 'number') {
      return value !== 0;
    }
  }
  return defaultValue;
}

export function getValBoolean(element: Element, defaultValue: boolean = true) {
  return normalizeBoolean(getVal(element), defaultValue);
}

export function getAttrBoolean(
  element: Element,
  attr: string,
  defaultValue: boolean = true
) {
  return normalizeBoolean(element.getAttribute(attr), defaultValue);
}

/**
 *
 */
export function getAttrNumber(
  element: Element,
  attr: string,
  defaultValue: number = 0
) {
  const value = element.getAttribute(attr);
  if (value) {
    return parseInt(value, 10);
  } else {
    return defaultValue;
  }
}

/**
 * http://webapp.docx4java.org/OnlineDemo/ecma376/DrawingML/ST_Percentage.html
 * https://c-rex.net/projects/samples/ooxml/e1/Part4/OOXML_P4_DOCX_ST_Percentage_topic_ID0EY3XNB.html#topic_ID0EY3XNB
 *
 */
export function getAttrPercent(element: Element, attr: string) {
  const value = element.getAttribute(attr);

  if (value) {
    if (value.endsWith('%')) {
      return parseInt(value, 10) / 100;
    }
    const num = parseInt(value, 10);
    return num / 100000;
  }

  return 1;
}

/**
 */
export function getValHex(element: Element) {
  return parseInt(getVal(element) || '0', 16);
}
