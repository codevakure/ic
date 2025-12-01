/**
 * OOXML Word Document Types
 * Based on Office Open XML specification
 */

/**
 * Paragraph properties
 */
export interface ParagraphProperties {
  alignment?: 'left' | 'center' | 'right' | 'justify' | 'both' | 'distribute';
  indentation?: {
    left?: number;
    right?: number;
    hanging?: number;
    firstLine?: number;
  };
  spacing?: {
    before?: number;
    after?: number;
    line?: number;
    lineRule?: 'auto' | 'exact' | 'atLeast';
  };
  borders?: BorderProperties;
  shading?: ShadingProperties;
  numbering?: {
    numId?: string;
    ilvl?: number;
  };
  outlineLevel?: number;
  keepNext?: boolean;
  keepLines?: boolean;
  pageBreakBefore?: boolean;
  widowControl?: boolean;
  style?: string;
}

/**
 * Run (text span) properties
 */
export interface RunProperties {
  bold?: boolean;
  italic?: boolean;
  underline?: string | boolean;
  strike?: boolean;
  doubleStrike?: boolean;
  smallCaps?: boolean;
  allCaps?: boolean;
  color?: string;
  highlight?: string;
  font?: string;
  fontSize?: number;
  vertAlign?: 'superscript' | 'subscript' | 'baseline';
  spacing?: number;
  position?: number;
  shading?: ShadingProperties;
  border?: BorderProperties;
  style?: string;
}

/**
 * Border properties
 */
export interface BorderProperties {
  top?: Border;
  bottom?: Border;
  left?: Border;
  right?: Border;
  insideH?: Border;
  insideV?: Border;
}

export interface Border {
  style?: string;
  color?: string;
  size?: number;
  space?: number;
  shadow?: boolean;
  frame?: boolean;
}

/**
 * Shading properties
 */
export interface ShadingProperties {
  fill?: string;
  color?: string;
  pattern?: string;
}

/**
 * Table properties
 */
export interface TableProperties {
  width?: Length;
  alignment?: 'left' | 'center' | 'right';
  indent?: number;
  borders?: TableBorders;
  cellMargins?: CellMargins;
  layout?: 'fixed' | 'autofit';
  look?: TableLook;
  style?: string;
  shading?: ShadingProperties;
  cellSpacing?: number;
}

export interface TableBorders extends BorderProperties {
  insideH?: Border;
  insideV?: Border;
}

export interface CellMargins {
  top?: number;
  bottom?: number;
  left?: number;
  right?: number;
}

export interface TableLook {
  firstRow?: boolean;
  lastRow?: boolean;
  firstColumn?: boolean;
  lastColumn?: boolean;
  noHBand?: boolean;
  noVBand?: boolean;
}

/**
 * Table row properties
 */
export interface TableRowProperties {
  height?: {
    value?: number;
    rule?: 'auto' | 'exact' | 'atLeast';
  };
  header?: boolean;
  cantSplit?: boolean;
}

/**
 * Table cell properties
 */
export interface TableCellProperties {
  width?: Length;
  gridSpan?: number;
  vMerge?: 'restart' | 'continue';
  borders?: BorderProperties;
  shading?: ShadingProperties;
  margins?: CellMargins;
  vAlign?: 'top' | 'center' | 'bottom';
  textDirection?: 'lrTb' | 'tbRl' | 'btLr' | 'lrTbV' | 'tbRlV' | 'tbLrV';
  noWrap?: boolean;
}

/**
 * Length with unit
 */
export interface Length {
  value: number;
  unit: 'auto' | 'dxa' | 'pct' | 'nil';
}

/**
 * Section properties
 */
export interface SectionProperties {
  pageSize?: {
    width?: number;
    height?: number;
    orientation?: 'portrait' | 'landscape';
  };
  pageMargin?: {
    top?: number;
    bottom?: number;
    left?: number;
    right?: number;
    header?: number;
    footer?: number;
    gutter?: number;
  };
  columns?: {
    count?: number;
    space?: number;
    equalWidth?: boolean;
  };
  headerReference?: Array<{ type: string; id: string }>;
  footerReference?: Array<{ type: string; id: string }>;
  pageNumbering?: {
    start?: number;
    format?: string;
  };
  lineNumbering?: {
    start?: number;
    restart?: 'newPage' | 'newSection' | 'continuous';
  };
  verticalAlignment?: 'top' | 'center' | 'both' | 'bottom';
  type?: 'nextPage' | 'nextColumn' | 'continuous' | 'evenPage' | 'oddPage';
}

/**
 * Drawing/Image properties
 */
export interface DrawingProperties {
  inline?: boolean;
  anchor?: AnchorProperties;
  extent?: { cx: number; cy: number };
  effectExtent?: { l: number; t: number; r: number; b: number };
  wrapType?: 'square' | 'tight' | 'through' | 'topAndBottom';
  docProperties?: {
    id: number;
    name: string;
    descr?: string;
    title?: string;
  };
}

export interface AnchorProperties {
  distT?: number;
  distB?: number;
  distL?: number;
  distR?: number;
  simplePos?: boolean;
  relativeHeight?: number;
  behindDoc?: boolean;
  locked?: boolean;
  layoutInCell?: boolean;
  allowOverlap?: boolean;
}

/**
 * Hyperlink properties
 */
export interface HyperlinkProperties {
  id?: string;
  anchor?: string;
  tooltip?: string;
  history?: boolean;
}

/**
 * Bookmark properties
 */
export interface BookmarkProperties {
  id: string;
  name: string;
}

/**
 * Field properties
 */
export interface FieldProperties {
  type: string;
  code: string;
  result?: string;
  dirty?: boolean;
  locked?: boolean;
}

/**
 * CSS Style object
 */
export interface CSSStyle {
  [key: string]: string | number | undefined;
}

/**
 * Content Types
 */
export interface ContentTypes {
  defaults: Map<string, string>;
  overrides: Map<string, string>;
}

/**
 * Relationship
 */
export interface Relationship {
  id: string;
  type: string;
  target: string;
  targetMode?: 'Internal' | 'External';
}

/**
 * Theme colors
 */
export interface ThemeColors {
  [key: string]: string;
}

/**
 * Numbering definition
 */
export interface NumberingDefinition {
  numId: string;
  abstractNumId: string;
  levels: NumberingLevel[];
}

export interface NumberingLevel {
  ilvl: number;
  start?: number;
  numFmt?: string;
  text?: string;
  alignment?: string;
  font?: string;
  indent?: { left?: number; hanging?: number };
  pStyle?: string;
}

/**
 * Style definition
 */
export interface StyleDefinition {
  styleId: string;
  name?: string;
  basedOn?: string;
  next?: string;
  link?: string;
  type: 'paragraph' | 'character' | 'table' | 'numbering';
  default?: boolean;
  customStyle?: boolean;
  qFormat?: boolean;
  hidden?: boolean;
  semiHidden?: boolean;
  unhideWhenUsed?: boolean;
  uiPriority?: number;
  locked?: boolean;
  personal?: boolean;
  personalCompose?: boolean;
  personalReply?: boolean;
  rsid?: string;
  pPr?: ParagraphProperties;
  rPr?: RunProperties;
  tblPr?: TableProperties;
  trPr?: TableRowProperties;
  tcPr?: TableCellProperties;
}

/**
 * Font definition
 */
export interface FontDefinition {
  name: string;
  family?: string;
  pitch?: string;
  charset?: number;
  embedRegular?: string;
  embedBold?: string;
  embedItalic?: string;
  embedBoldItalic?: string;
}
