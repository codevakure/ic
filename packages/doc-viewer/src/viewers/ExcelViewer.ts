import { DocumentViewer } from '../core/DocumentViewer';
import type { DocumentMetadata, SearchResult, ViewerOptions } from '../core/types';
import { ZipParser } from '../parsers/zip/ZipParser';
import { PackageParser } from '../parsers/ooxml/PackageParser';

/**
 * Excel-specific options
 */
export interface ExcelOptions extends Partial<ViewerOptions> {
  /**
   * Active sheet index
   */
  activeSheet?: number;

  /**
   * Show gridlines
   */
  showGridlines?: boolean;

  /**
   * Show row/column headers
   */
  showHeaders?: boolean;

  /**
   * Enable formula evaluation
   */
  enableFormulas?: boolean;

  /**
   * Render mode
   */
  renderMode?: 'html' | 'canvas';
}

/**
 * Excel Document Viewer
 * Renders XLSX files using OOXML parsing
 */
export class ExcelViewer extends DocumentViewer {
  private zipParser: ZipParser | null = null;
  private packageParser: PackageParser | null = null;
  private workbookXml: Document | null = null;
  private sheets: Map<string, Document> = new Map();
  private sharedStrings: string[] = [];

  constructor(container: HTMLElement, options: ExcelOptions = {}) {
    super(container, options);
  }

  /**
   * Render Excel document from ArrayBuffer
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

      this.reportProgress(40);

      // Parse workbook
      await this.parseWorkbook();

      this.reportProgress(60);

      // Parse shared strings
      await this.parseSharedStrings();

      this.reportProgress(70);

      // Parse sheets
      await this.parseSheets();

      this.reportProgress(80);

      // Render active sheet
      await this.renderActiveSheet();

      this.reportProgress(100);
      this.emitLoad();
    } catch (error) {
      this.handleError(error as Error);
      throw error;
    }
  }

  /**
   * Parse workbook.xml
   */
  private async parseWorkbook(): Promise<void> {
    if (!this.zipParser) return;

    const workbookXml = this.zipParser.getFileAsXml('xl/workbook.xml');
    if (!workbookXml) {
      throw new Error('Could not parse workbook.xml');
    }
    this.workbookXml = workbookXml;
  }

  /**
   * Parse shared strings
   */
  private async parseSharedStrings(): Promise<void> {
    if (!this.zipParser) return;

    const sharedStringsXml = this.zipParser.getFileAsXml('xl/sharedStrings.xml');
    if (!sharedStringsXml) {
      this.sharedStrings = [];
      return;
    }

    const siElements = sharedStringsXml.querySelectorAll('si');
    for (let i = 0; i < siElements.length; i++) {
      const si = siElements[i];
      if (!si) continue;
      const t = si.querySelector('t');
      this.sharedStrings.push(t?.textContent || '');
    }
  }

  /**
   * Parse all sheets
   */
  private async parseSheets(): Promise<void> {
    if (!this.zipParser || !this.workbookXml) return;

    const sheets = this.workbookXml.querySelectorAll('sheet');
    for (let i = 0; i < sheets.length; i++) {
      const sheet = sheets[i];
      if (!sheet) continue;
      const sheetId = sheet.getAttribute('sheetId');
      const name = sheet.getAttribute('name');
      
      if (!sheetId) continue;

      // Load sheet XML
      const sheetPath = `xl/worksheets/sheet${sheetId}.xml`;
      const sheetXml = this.zipParser.getFileAsXml(sheetPath);
      if (sheetXml && name) {
        this.sheets.set(name, sheetXml);
      }
    }
  }

  /**
   * Render active sheet
   */
  private async renderActiveSheet(): Promise<void> {
    const sheetName = Array.from(this.sheets.keys())[0];
    if (!sheetName) return;

    const sheetXml = this.sheets.get(sheetName);
    if (!sheetXml) return;

    const sheetContainer = document.createElement('div');
    sheetContainer.className = `${this.options.classPrefix}excel-sheet`;

    // Create table
    const table = document.createElement('table');
    table.className = `${this.options.classPrefix}excel-table`;

    // Get sheet data
    const sheetData = sheetXml.querySelector('sheetData');
    if (!sheetData) return;

    // Render rows
    const rows = sheetData.querySelectorAll('row');
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (!row) continue;
      const tr = this.renderRow(row);
      table.appendChild(tr);
    }

    sheetContainer.appendChild(table);
    this.container.appendChild(sheetContainer);
  }

  /**
   * Render row
   */
  private renderRow(rowXml: Element): HTMLElement {
    const tr = document.createElement('tr');

    const cells = rowXml.querySelectorAll('c');
    for (let i = 0; i < cells.length; i++) {
      const cell = cells[i];
      if (!cell) continue;
      const td = this.renderCell(cell);
      tr.appendChild(td);
    }

    return tr;
  }

  /**
   * Render cell
   */
  private renderCell(cellXml: Element): HTMLElement {
    const td = document.createElement('td');
    td.className = `${this.options.classPrefix}excel-cell`;

    const type = cellXml.getAttribute('t');
    const valueElement = cellXml.querySelector('v');
    const value = valueElement?.textContent || '';

    // Resolve cell value
    if (type === 's') {
      // Shared string
      const index = parseInt(value, 10);
      td.textContent = this.sharedStrings[index] || '';
    } else {
      // Direct value
      td.textContent = value;
    }

    return td;
  }

  /**
   * Get document metadata
   */
  getMetadata(): DocumentMetadata {
    return {
      pageCount: this.sheets.size,
    };
  }

  /**
   * Search in document
   */
  async search(query: string): Promise<SearchResult[]> {
    const results: SearchResult[] = [];
    
    if (!query) return results;

    const normalizedQuery = query.toLowerCase();

    for (const [sheetName, sheetXml] of this.sheets) {
      const cells = sheetXml.querySelectorAll('c');
      for (let i = 0; i < cells.length; i++) {
        const cell = cells[i];
        if (!cell) continue;
        const valueEl = cell.querySelector('v');
        const value = valueEl?.textContent || '';
        
        if (value.toLowerCase().includes(normalizedQuery)) {
          results.push({
            text: query,
            pageNumber: 1,
            position: { x: 0, y: 0 },
            context: `${sheetName}: ${value}`,
          });
        }
      }
    }

    return results;
  }

  /**
   * Switch to different sheet
   */
  switchSheet(sheetName: string): void {
    const sheetXml = this.sheets.get(sheetName);
    if (!sheetXml) return;

    // Clear container
    this.container.innerHTML = '';

    // Render new sheet
    this.renderActiveSheet();
  }

  /**
   * Get sheet names
   */
  getSheetNames(): string[] {
    return Array.from(this.sheets.keys());
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
    this.workbookXml = null;
    this.sheets.clear();
    this.sharedStrings = [];
  }
}
