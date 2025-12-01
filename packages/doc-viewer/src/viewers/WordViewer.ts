import { DocumentViewer } from '../core/DocumentViewer';
import type { DocumentMetadata, SearchResult, ViewerOptions } from '../core/types';
import { ZipParser } from '../parsers/zip/ZipParser';
import { PackageParser } from '../parsers/ooxml/PackageParser';
import {
  parseParagraphProperties,
  parseRunProperties,
  applyParagraphPropertiesToStyle,
  applyRunPropertiesToStyle,
} from '../word/parse/parseProperties';
import { createElement, applyCSSStyle, getAttr } from '../utils/dom';

/**
 * Word-specific options
 */
export interface WordOptions extends Partial<ViewerOptions> {
  /**
   * Enable outline/TOC
   */
  showOutline?: boolean;

  /**
   * Render mode
   */
  renderMode?: 'html' | 'canvas';

  /**
   * Enable comments
   */
  showComments?: boolean;

  /**
   * Enable track changes
   */
  showTrackChanges?: boolean;
}

/**
 * Word Document Viewer
 * Renders DOCX files using OOXML parsing
 */
export class WordViewer extends DocumentViewer {
  private zipParser: ZipParser | null = null;
  private packageParser: PackageParser | null = null;
  private documentXml: Document | null = null;

  constructor(container: HTMLElement, options: WordOptions = {}) {
    super(container, options);
  }

  /**
   * Render Word document from ArrayBuffer
   */
  async renderFile(data: ArrayBuffer): Promise<void> {
    try {
      this.reportProgress(10);

      // Parse ZIP structure
      this.zipParser = new ZipParser();
      await this.zipParser.parse(data);

      this.reportProgress(30);

      // Parse OOXML package
      this.packageParser = new PackageParser(this.zipParser);
      await this.packageParser.parse();

      this.reportProgress(50);

      // Get main document part
      const mainPart = this.packageParser.getMainDocumentPart();
      if (!mainPart) {
        throw new Error('Could not find main document part');
      }

      // Parse document.xml
      const docXml = this.zipParser.getFileAsXml(mainPart);
      if (!docXml) {
        throw new Error('Could not parse document.xml');
      }
      this.documentXml = docXml;

      this.reportProgress(70);

      // Render document
      await this.renderDocument();

      this.reportProgress(100);
      this.emitLoad();
    } catch (error) {
      this.handleError(error as Error);
      throw error;
    }
  }

  /**
   * Render document to HTML
   */
  private async renderDocument(): Promise<void> {
    if (!this.documentXml) return;

    const docElement = createElement('div', `${this.options.classPrefix}word-document`);

    // Get document body
    const body = this.documentXml.querySelector('w\\:body, body');
    if (!body) return;

    // Render all child elements in order
    for (let i = 0; i < body.children.length; i++) {
      const child = body.children[i];
      if (!child) continue;

      const tagName = child.tagName || child.nodeName;

      if (tagName === 'w:p' || tagName === 'p') {
        const paraElement = this.renderParagraph(child);
        if (paraElement) docElement.appendChild(paraElement);
      } else if (tagName === 'w:tbl' || tagName === 'tbl') {
        const tableElement = this.renderTable(child);
        if (tableElement) docElement.appendChild(tableElement);
      } else if (tagName === 'w:sectPr' || tagName === 'sectPr') {
        // Section properties - skip for now
        continue;
      }
    }

    this.container.appendChild(docElement);
  }

  /**
   * Render paragraph
   */
  private renderParagraph(paraXml: Element): HTMLElement | null {
    const para = createElement('p', `${this.options.classPrefix}paragraph`);

    // Parse and apply paragraph properties
    const pPr = paraXml.querySelector('w\\:pPr, pPr');
    if (pPr) {
      const props = parseParagraphProperties(pPr);
      const style = applyParagraphPropertiesToStyle(props);
      applyCSSStyle(para, style);
    }

    // Render child elements in order
    for (let i = 0; i < paraXml.children.length; i++) {
      const child = paraXml.children[i];
      if (!child) continue;

      const tagName = child.tagName || child.nodeName;

      if (tagName === 'w:r' || tagName === 'r') {
        const runElement = this.renderRun(child);
        if (runElement) para.appendChild(runElement);
      } else if (tagName === 'w:hyperlink' || tagName === 'hyperlink') {
        const linkElement = this.renderHyperlink(child);
        if (linkElement) para.appendChild(linkElement);
      } else if (tagName === 'w:bookmarkStart' || tagName === 'bookmarkStart') {
        // Bookmark - could add anchor
        const id = getAttr(child, 'w:id');
        const name = getAttr(child, 'w:name');
        if (id && name) {
          const anchor = createElement('a', `${this.options.classPrefix}bookmark`);
          anchor.setAttribute('id', name);
          para.appendChild(anchor);
        }
      }
    }

    // If paragraph is empty, add a line break to maintain spacing
    if (para.childNodes.length === 0) {
      para.appendChild(createElement('br'));
    }

    return para;
  }

  /**
   * Render run (text with formatting)
   */
  private renderRun(runXml: Element): HTMLElement | null {
    const span = createElement('span', `${this.options.classPrefix}run`);

    // Parse and apply run properties
    const rPr = runXml.querySelector('w\\:rPr, rPr');
    if (rPr) {
      const props = parseRunProperties(rPr);
      const style = applyRunPropertiesToStyle(props);
      applyCSSStyle(span, style);
    }

    // Render child elements
    for (let i = 0; i < runXml.children.length; i++) {
      const child = runXml.children[i];
      if (!child) continue;

      const tagName = child.tagName || child.nodeName;

      if (tagName === 'w:t' || tagName === 't') {
        // Text content
        const text = child.textContent || '';
        span.appendChild(document.createTextNode(text));
      } else if (tagName === 'w:tab' || tagName === 'tab') {
        // Tab character
        span.appendChild(document.createTextNode('\t'));
      } else if (tagName === 'w:br' || tagName === 'br') {
        // Line break
        span.appendChild(createElement('br'));
      } else if (tagName === 'w:cr' || tagName === 'cr') {
        // Carriage return
        span.appendChild(createElement('br'));
      } else if (tagName === 'w:drawing' || tagName === 'drawing') {
        // Drawing/image - simplified
        const img = this.renderDrawing(child);
        if (img) span.appendChild(img);
      } else if (tagName === 'w:sym' || tagName === 'sym') {
        // Symbol
        const font = getAttr(child, 'w:font');
        const charCode = getAttr(child, 'w:char');
        if (charCode) {
          const symbolSpan = createElement('span');
          if (font) symbolSpan.style.fontFamily = font;
          symbolSpan.textContent = String.fromCharCode(parseInt(charCode, 16));
          span.appendChild(symbolSpan);
        }
      }
    }

    return span.childNodes.length > 0 ? span : null;
  }

  /**
   * Render hyperlink
   */
  private renderHyperlink(hyperlinkXml: Element): HTMLElement | null {
    const anchor = createElement('a', `${this.options.classPrefix}hyperlink`);

    // Get relationship ID
    const rId = getAttr(hyperlinkXml, 'r:id');
    if (rId && this.packageParser) {
      const mainPart = this.packageParser.getMainDocumentPart();
      if (mainPart) {
        const rel = this.packageParser.getRelationshipById(mainPart, rId);
        if (rel && rel.target) {
          anchor.setAttribute('href', rel.target);
          if (rel.targetMode === 'External') {
            anchor.setAttribute('target', '_blank');
            anchor.setAttribute('rel', 'noopener noreferrer');
          }
        }
      }
    }

    // Get anchor
    const anchorAttr = getAttr(hyperlinkXml, 'w:anchor');
    if (anchorAttr) {
      anchor.setAttribute('href', `#${anchorAttr}`);
    }

    // Get tooltip
    const tooltip = getAttr(hyperlinkXml, 'w:tooltip');
    if (tooltip) {
      anchor.setAttribute('title', tooltip);
    }

    // Render runs inside hyperlink
    for (let i = 0; i < hyperlinkXml.children.length; i++) {
      const child = hyperlinkXml.children[i];
      if (!child) continue;

      const tagName = child.tagName || child.nodeName;
      if (tagName === 'w:r' || tagName === 'r') {
        const runElement = this.renderRun(child);
        if (runElement) anchor.appendChild(runElement);
      }
    }

    return anchor.childNodes.length > 0 ? anchor : null;
  }

  /**
   * Render drawing/image (simplified)
   */
  private renderDrawing(drawingXml: Element): HTMLElement | null {
    // Find image reference
    const blip = drawingXml.querySelector('a\\:blip, blip');
    if (!blip) return null;

    const rId = getAttr(blip, 'r:embed') || getAttr(blip, 'r:link');
    if (!rId || !this.zipParser || !this.packageParser) return null;

    // Get image from package
    const mainPart = this.packageParser.getMainDocumentPart();
    if (!mainPart) return null;

    const rel = this.packageParser.getRelationshipById(mainPart, rId);
    if (!rel) return null;

    const imagePath = this.packageParser.resolveTarget(mainPart, rel.target);
    const imageData = this.zipParser.getFile(imagePath);
    if (!imageData) return null;

    // Create image element
    const img = createElement('img', `${this.options.classPrefix}image`) as HTMLImageElement;

    // Convert to data URL
    // Type cast needed due to TypeScript strict buffer type checking
    const blob = new Blob([imageData as any], {type: 'image/png'});
    const url = URL.createObjectURL(blob);
    img.src = url;
    
    // Cleanup URL when image loads
    img.onload = () => URL.revokeObjectURL(url);

    // Get size from extent
    const extent = drawingXml.querySelector('wp\\:extent, extent');
    if (extent) {
      const cx = getAttr(extent, 'cx');
      const cy = getAttr(extent, 'cy');
      if (cx && cy) {
        // Convert EMU to pixels
        img.style.width = `${parseInt(cx, 10) / 914400 * 96}px`;
        img.style.height = `${parseInt(cy, 10) / 914400 * 96}px`;
      }
    }

    return img;
  }

  /**
   * Render table
   */
  private renderTable(tableXml: Element): HTMLElement {
    const table = createElement('table', `${this.options.classPrefix}table`);

    // Render table rows
    for (let i = 0; i < tableXml.children.length; i++) {
      const child = tableXml.children[i];
      if (!child) continue;

      const tagName = child.tagName || child.nodeName;

      if (tagName === 'w:tr' || tagName === 'tr') {
        const tr = this.renderTableRow(child);
        if (tr) table.appendChild(tr);
      }
    }

    return table;
  }

  /**
   * Render table row
   */
  private renderTableRow(rowXml: Element): HTMLElement | null {
    const tr = createElement('tr', `${this.options.classPrefix}table-row`);

    // Render table cells
    for (let i = 0; i < rowXml.children.length; i++) {
      const child = rowXml.children[i];
      if (!child) continue;

      const tagName = child.tagName || child.nodeName;

      if (tagName === 'w:tc' || tagName === 'tc') {
        const td = this.renderTableCell(child);
        if (td) tr.appendChild(td);
      }
    }

    return tr.childNodes.length > 0 ? tr : null;
  }

  /**
   * Render table cell
   */
  private renderTableCell(cellXml: Element): HTMLElement | null {
    const td = createElement('td', `${this.options.classPrefix}table-cell`);

    // Parse cell properties
    const tcPr = cellXml.querySelector('w\\:tcPr, tcPr');
    if (tcPr) {
      // Grid span (colspan)
      const gridSpan = tcPr.querySelector('w\\:gridSpan, gridSpan');
      if (gridSpan) {
        const spanValue = getAttr(gridSpan, 'w:val');
        if (spanValue) {
          td.setAttribute('colspan', spanValue);
        }
      }

      // Vertical merge (rowspan) - simplified
      const vMerge = tcPr.querySelector('w\\:vMerge, vMerge');
      if (vMerge) {
        const val = getAttr(vMerge, 'w:val');
        if (val === 'restart') {
          // Start of merge - need to count cells below
          td.setAttribute('data-vmerge', 'restart');
        } else if (!val || val === 'continue') {
          // Continue merge - hide this cell
          td.style.display = 'none';
        }
      }

      // Vertical alignment
      const vAlign = tcPr.querySelector('w\\:vAlign, vAlign');
      if (vAlign) {
        const alignValue = getAttr(vAlign, 'w:val');
        const alignMap: Record<string, string> = {
          'top': 'top',
          'center': 'middle',
          'bottom': 'bottom',
        };
        td.style.verticalAlign = alignMap[alignValue] || 'top';
      }

      // Background color
      const shd = tcPr.querySelector('w\\:shd, shd');
      if (shd) {
        const fill = getAttr(shd, 'w:fill');
        if (fill && fill !== 'auto') {
          td.style.backgroundColor = fill.startsWith('#') ? fill : `#${fill}`;
        }
      }
    }

    // Render cell content (paragraphs)
    for (let i = 0; i < cellXml.children.length; i++) {
      const child = cellXml.children[i];
      if (!child) continue;

      const tagName = child.tagName || child.nodeName;

      if (tagName === 'w:p' || tagName === 'p') {
        const paraElement = this.renderParagraph(child);
        if (paraElement) td.appendChild(paraElement);
      } else if (tagName === 'w:tbl' || tagName === 'tbl') {
        // Nested table
        const nestedTable = this.renderTable(child);
        if (nestedTable) td.appendChild(nestedTable);
      }
    }

    return td;
  }

  /**
   * Get document metadata
   */
  getMetadata(): DocumentMetadata {
    // TODO: Parse core.xml for metadata
    return {};
  }

  /**
   * Search in document
   */
  async search(query: string): Promise<SearchResult[]> {
    const results: SearchResult[] = [];
    
    if (!this.documentXml || !query) return results;

    const normalizedQuery = query.toLowerCase();
    const body = this.documentXml.querySelector('body');
    if (!body) return results;

    // Search in text elements
    const textElements = body.querySelectorAll('t');
    for (let i = 0; i < textElements.length; i++) {
      const textEl = textElements[i];
      if (!textEl) continue;
      const text = textEl.textContent || '';
      if (text.toLowerCase().includes(normalizedQuery)) {
        results.push({
          text: query,
          pageNumber: 1, // Word doesn't have pages in XML
          position: { x: 0, y: 0 },
          context: text,
        });
      }
    }

    return results;
  }

  /**
   * Cleanup resources
   */
  protected cleanup(): void {
    if (this.zipParser) {
      this.zipParser.clear();
      this.zipParser = null;
    }
    this.packageParser = null;
    this.documentXml = null;
  }
}
