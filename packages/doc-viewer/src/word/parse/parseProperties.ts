/**
 * Word Document Parser
 * Parses paragraphs, runs, and tables from OOXML
 */

import type {
  ParagraphProperties,
  RunProperties,
  CSSStyle,
} from '../../openxml/WordTypes';
import { getAttr } from '../../utils/dom';
import { getVal, getValBoolean, getValNumber, getChild } from '../../openxml/OpenXML';
import { twipToPx, dxaToPx, halfPtToPx } from '../../utils/units';
import { normalizeColor } from '../../utils/color';

/**
 * Parse paragraph properties from pPr element
 */
export function parseParagraphProperties(pPr: Element): ParagraphProperties {
  const props: ParagraphProperties = {};

  for (let i = 0; i < pPr.children.length; i++) {
    const child = pPr.children[i];
    if (!child) continue;

    const tagName = child.tagName || child.nodeName;

    switch (tagName) {
      case 'w:jc': // Alignment
        props.alignment = getVal(child) as any;
        break;

      case 'w:ind': // Indentation
        props.indentation = {
          left: dxaToPx(getAttr(child, 'w:left') || getAttr(child, 'w:start')),
          right: dxaToPx(getAttr(child, 'w:right') || getAttr(child, 'w:end')),
          hanging: dxaToPx(getAttr(child, 'w:hanging')),
          firstLine: dxaToPx(getAttr(child, 'w:firstLine')),
        };
        break;

      case 'w:spacing': // Spacing
        props.spacing = {
          before: twipToPx(getAttr(child, 'w:before')),
          after: twipToPx(getAttr(child, 'w:after')),
          line: twipToPx(getAttr(child, 'w:line')),
          lineRule: getAttr(child, 'w:lineRule') as any,
        };
        break;

      case 'w:numPr': // Numbering
        const numId = getChild(child, 'numId');
        const ilvl = getChild(child, 'ilvl');
        if (numId || ilvl) {
          props.numbering = {
            numId: numId ? getVal(numId) : undefined,
            ilvl: ilvl ? getValNumber(ilvl, 0) : 0,
          };
        }
        break;

      case 'w:pStyle': // Style reference
        props.style = getVal(child);
        break;

      case 'w:keepNext': // Keep with next
        props.keepNext = getValBoolean(child, true);
        break;

      case 'w:keepLines': // Keep lines together
        props.keepLines = getValBoolean(child, true);
        break;

      case 'w:pageBreakBefore': // Page break before
        props.pageBreakBefore = getValBoolean(child, true);
        break;

      case 'w:widowControl': // Widow control
        props.widowControl = getValBoolean(child, true);
        break;

      case 'w:outlineLvl': // Outline level
        props.outlineLevel = getValNumber(child, 0);
        break;
    }
  }

  return props;
}

/**
 * Parse run properties from rPr element
 */
export function parseRunProperties(rPr: Element, themes?: Map<string, string>): RunProperties {
  const props: RunProperties = {};

  for (let i = 0; i < rPr.children.length; i++) {
    const child = rPr.children[i];
    if (!child) continue;

    const tagName = child.tagName || child.nodeName;

    switch (tagName) {
      case 'w:b': // Bold
        props.bold = getValBoolean(child, true);
        break;

      case 'w:i': // Italic
        props.italic = getValBoolean(child, true);
        break;

      case 'w:u': // Underline
        const uVal = getVal(child);
        props.underline = uVal === 'none' ? false : uVal || true;
        break;

      case 'w:strike': // Strikethrough
        props.strike = getValBoolean(child, true);
        break;

      case 'w:dstrike': // Double strikethrough
        props.doubleStrike = getValBoolean(child, true);
        break;

      case 'w:smallCaps': // Small caps
        props.smallCaps = getValBoolean(child, true);
        break;

      case 'w:caps': // All caps
        props.allCaps = getValBoolean(child, true);
        break;

      case 'w:color': // Text color
        const color = getAttr(child, 'w:val');
        const themeColor = getAttr(child, 'w:themeColor');
        const themeTint = getAttr(child, 'w:themeTint');
        const themeShade = getAttr(child, 'w:themeShade');
        props.color = normalizeColor(color, themeColor, themeTint, themeShade, themes);
        break;

      case 'w:highlight': // Highlight color
        props.highlight = getAttr(child, 'w:val');
        break;

      case 'w:rFonts': // Font
        props.font = getAttr(child, 'w:ascii') || getAttr(child, 'w:hAnsi') || getAttr(child, 'w:cs');
        break;

      case 'w:sz': // Font size (half-points)
        props.fontSize = halfPtToPx(getVal(child));
        break;

      case 'w:vertAlign': // Vertical alignment (superscript/subscript)
        props.vertAlign = getVal(child) as any;
        break;

      case 'w:spacing': // Character spacing
        props.spacing = twipToPx(getVal(child));
        break;

      case 'w:position': // Position (raise/lower)
        props.position = halfPtToPx(getVal(child));
        break;

      case 'w:rStyle': // Style reference
        props.style = getVal(child);
        break;
    }
  }

  return props;
}

/**
 * Apply paragraph properties to CSS style
 */
export function applyParagraphPropertiesToStyle(props: ParagraphProperties): CSSStyle {
  const style: CSSStyle = {};

  if (props.alignment) {
    const alignmentMap: Record<string, string> = {
      'left': 'left',
      'center': 'center',
      'right': 'right',
      'justify': 'justify',
      'both': 'justify',
      'distribute': 'justify',
    };
    style['text-align'] = alignmentMap[props.alignment] || 'left';
  }

  if (props.indentation) {
    if (props.indentation.left) {
      style['margin-left'] = `${props.indentation.left}px`;
    }
    if (props.indentation.right) {
      style['margin-right'] = `${props.indentation.right}px`;
    }
    if (props.indentation.firstLine) {
      style['text-indent'] = `${props.indentation.firstLine}px`;
    }
    if (props.indentation.hanging) {
      style['text-indent'] = `-${props.indentation.hanging}px`;
      style['padding-left'] = `${props.indentation.hanging}px`;
    }
  }

  if (props.spacing) {
    if (props.spacing.before) {
      style['margin-top'] = `${props.spacing.before}px`;
    }
    if (props.spacing.after) {
      style['margin-bottom'] = `${props.spacing.after}px`;
    }
    if (props.spacing.line) {
      if (props.spacing.lineRule === 'exact') {
        style['line-height'] = `${props.spacing.line}px`;
      } else if (props.spacing.lineRule === 'atLeast') {
        style['min-height'] = `${props.spacing.line}px`;
      } else {
        // Auto - treat as multiplier (240 twips = 1.0 line spacing)
        style['line-height'] = String(props.spacing.line / 240);
      }
    }
  }

  if (props.keepNext) {
    style['page-break-after'] = 'avoid';
  }

  if (props.pageBreakBefore) {
    style['page-break-before'] = 'always';
  }

  return style;
}

/**
 * Apply run properties to CSS style
 */
export function applyRunPropertiesToStyle(props: RunProperties): CSSStyle {
  const style: CSSStyle = {};

  if (props.bold) {
    style['font-weight'] = 'bold';
  }

  if (props.italic) {
    style['font-style'] = 'italic';
  }

  if (props.underline) {
    style['text-decoration'] = style['text-decoration'] || '';
    style['text-decoration'] += ' underline';
  }

  if (props.strike || props.doubleStrike) {
    style['text-decoration'] = style['text-decoration'] || '';
    style['text-decoration'] += ' line-through';
  }

  if (props.smallCaps) {
    style['font-variant'] = 'small-caps';
  }

  if (props.allCaps) {
    style['text-transform'] = 'uppercase';
  }

  if (props.color) {
    style['color'] = props.color;
  }

  if (props.highlight) {
    const highlightMap: Record<string, string> = {
      'yellow': '#FFFF00',
      'green': '#00FF00',
      'cyan': '#00FFFF',
      'magenta': '#FF00FF',
      'blue': '#0000FF',
      'red': '#FF0000',
      'darkBlue': '#00008B',
      'darkCyan': '#008B8B',
      'darkGreen': '#006400',
      'darkMagenta': '#8B008B',
      'darkRed': '#8B0000',
      'darkYellow': '#808000',
      'darkGray': '#A9A9A9',
      'lightGray': '#D3D3D3',
    };
    style['background-color'] = highlightMap[props.highlight] || props.highlight;
  }

  if (props.font) {
    style['font-family'] = props.font;
  }

  if (props.fontSize) {
    style['font-size'] = `${props.fontSize}px`;
  }

  if (props.vertAlign === 'superscript') {
    style['vertical-align'] = 'super';
    style['font-size'] = '0.83em';
  } else if (props.vertAlign === 'subscript') {
    style['vertical-align'] = 'sub';
    style['font-size'] = '0.83em';
  }

  if (props.spacing) {
    style['letter-spacing'] = `${props.spacing}px`;
  }

  if (props.position) {
    style['position'] = 'relative';
    style['top'] = `-${props.position}px`;
  }

  return style;
}
