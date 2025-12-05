import { DocumentViewer } from '../core/DocumentViewer';
import type { DocumentMetadata, SearchResult, ViewerOptions } from '../core/types';

/**
 * CSV-specific options
 */
export interface CSVOptions extends Partial<ViewerOptions> {
  /**
   * Delimiter character (default: ',')
   */
  delimiter?: string;

  /**
   * Whether the first row is a header row
   */
  hasHeader?: boolean;

  /**
   * Show gridlines
   */
  showGridlines?: boolean;

  /**
   * Show row numbers
   */
  showRowNumbers?: boolean;

  /**
   * Maximum rows to display (0 = unlimited)
   */
  maxRows?: number;

  /**
   * Quote character (default: '"')
   */
  quoteChar?: string;
}

/**
 * Parsed CSV data
 */
interface CSVData {
  headers: string[];
  rows: string[][];
}

/**
 * CSV Document Viewer
 * Renders CSV files as HTML tables
 */
export class CSVViewer extends DocumentViewer {
  private csvData: CSVData = { headers: [], rows: [] };
  private csvOptions: CSVOptions;

  constructor(container: HTMLElement, options: CSVOptions = {}) {
    super(container, {
      ...options,
      classPrefix: options.classPrefix || 'doc-viewer-',
    });
    this.csvOptions = {
      delimiter: ',',
      hasHeader: true,
      showGridlines: true,
      showRowNumbers: true,
      maxRows: 0,
      quoteChar: '"',
      ...options,
    };
  }

  /**
   * Render CSV document from ArrayBuffer
   */
  async renderFile(data: ArrayBuffer): Promise<void> {
    try {
      this.reportProgress(10);

      // Convert ArrayBuffer to string
      const text = this.arrayBufferToString(data);

      this.reportProgress(30);

      // Parse CSV
      this.csvData = this.parseCSV(text);

      this.reportProgress(60);

      // Render table
      this.renderTable();

      this.reportProgress(100);
      this.emitLoad();
    } catch (error) {
      this.handleError(error as Error);
      throw error;
    }
  }

  /**
   * Convert ArrayBuffer to string
   */
  private arrayBufferToString(buffer: ArrayBuffer): string {
    const decoder = new TextDecoder('utf-8');
    return decoder.decode(buffer);
  }

  /**
   * Parse CSV string into structured data
   */
  private parseCSV(text: string): CSVData {
    const delimiter = this.csvOptions.delimiter || ',';
    const quoteChar = this.csvOptions.quoteChar || '"';
    const lines = this.splitLines(text);
    const rows: string[][] = [];

    for (const line of lines) {
      if (line.trim() === '') continue;
      const row = this.parseLine(line, delimiter, quoteChar);
      rows.push(row);
    }

    // Extract headers if first row is header
    let headers: string[] = [];
    let dataRows = rows;

    if (this.csvOptions.hasHeader && rows.length > 0) {
      headers = rows[0] || [];
      dataRows = rows.slice(1);
    }

    // Apply max rows limit
    if (this.csvOptions.maxRows && this.csvOptions.maxRows > 0) {
      dataRows = dataRows.slice(0, this.csvOptions.maxRows);
    }

    return { headers, rows: dataRows };
  }

  /**
   * Split text into lines handling different line endings
   */
  private splitLines(text: string): string[] {
    return text.split(/\r?\n/);
  }

  /**
   * Parse a single CSV line respecting quotes
   */
  private parseLine(line: string, delimiter: string, quoteChar: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    let i = 0;

    while (i < line.length) {
      const char = line[i];

      if (inQuotes) {
        if (char === quoteChar) {
          // Check for escaped quote (double quote)
          if (i + 1 < line.length && line[i + 1] === quoteChar) {
            current += quoteChar;
            i += 2;
            continue;
          } else {
            // End of quoted field
            inQuotes = false;
            i++;
            continue;
          }
        } else {
          current += char;
          i++;
        }
      } else {
        if (char === quoteChar) {
          inQuotes = true;
          i++;
        } else if (char === delimiter) {
          result.push(current.trim());
          current = '';
          i++;
        } else {
          current += char;
          i++;
        }
      }
    }

    // Add the last field
    result.push(current.trim());

    return result;
  }

  /**
   * Render CSV data as HTML table
   */
  private renderTable(): void {
    const container = document.createElement('div');
    container.className = `${this.options.classPrefix}csv-container`;

    const table = document.createElement('table');
    table.className = `${this.options.classPrefix}csv-table`;

    if (this.csvOptions.showGridlines) {
      table.classList.add(`${this.options.classPrefix}csv-gridlines`);
    }

    // Render header if present
    if (this.csvData.headers.length > 0) {
      const thead = document.createElement('thead');
      const headerRow = document.createElement('tr');

      if (this.csvOptions.showRowNumbers) {
        const th = document.createElement('th');
        th.className = `${this.options.classPrefix}csv-row-number`;
        th.textContent = '#';
        headerRow.appendChild(th);
      }

      for (const header of this.csvData.headers) {
        const th = document.createElement('th');
        th.className = `${this.options.classPrefix}csv-header`;
        th.textContent = header;
        headerRow.appendChild(th);
      }

      thead.appendChild(headerRow);
      table.appendChild(thead);
    }

    // Render data rows
    const tbody = document.createElement('tbody');
    let rowIndex = 1;

    for (const row of this.csvData.rows) {
      const tr = document.createElement('tr');

      if (this.csvOptions.showRowNumbers) {
        const td = document.createElement('td');
        td.className = `${this.options.classPrefix}csv-row-number`;
        td.textContent = String(rowIndex);
        tr.appendChild(td);
      }

      for (const cell of row) {
        const td = document.createElement('td');
        td.className = `${this.options.classPrefix}csv-cell`;
        td.textContent = cell;
        tr.appendChild(td);
      }

      tbody.appendChild(tr);
      rowIndex++;
    }

    table.appendChild(tbody);
    container.appendChild(table);
    this.container.appendChild(container);

    // Apply styles
    this.applyStyles();
  }

  /**
   * Apply default styles for CSV rendering
   */
  private applyStyles(): void {
    const styleId = `${this.options.classPrefix}csv-styles`;
    
    // Check if styles already exist
    if (document.getElementById(styleId)) return;

    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      .${this.options.classPrefix}csv-container {
        width: 100%;
        overflow: auto;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 14px;
      }
      .${this.options.classPrefix}csv-table {
        border-collapse: collapse;
        width: 100%;
        min-width: max-content;
      }
      .${this.options.classPrefix}csv-gridlines td,
      .${this.options.classPrefix}csv-gridlines th {
        border: 1px solid #e0e0e0;
      }
      .${this.options.classPrefix}csv-header {
        background-color: #f5f5f5;
        font-weight: 600;
        text-align: left;
        padding: 8px 12px;
        white-space: nowrap;
        position: sticky;
        top: 0;
        z-index: 1;
      }
      .${this.options.classPrefix}csv-cell {
        padding: 6px 12px;
        white-space: nowrap;
      }
      .${this.options.classPrefix}csv-row-number {
        background-color: #fafafa;
        color: #888;
        text-align: center;
        padding: 6px 8px;
        font-size: 12px;
        min-width: 40px;
      }
      .${this.options.classPrefix}csv-table tbody tr:hover {
        background-color: #f8f9fa;
      }
      .${this.options.classPrefix}csv-table tbody tr:nth-child(even) {
        background-color: #fafafa;
      }
    `;
    document.head.appendChild(style);
  }

  /**
   * Get document metadata
   */
  getMetadata(): DocumentMetadata {
    return {
      pageCount: 1,
    };
  }

  /**
   * Search in document
   */
  async search(query: string): Promise<SearchResult[]> {
    const results: SearchResult[] = [];
    
    if (!query) return results;

    const normalizedQuery = query.toLowerCase();

    // Search in headers
    for (const header of this.csvData.headers) {
      if (header.toLowerCase().includes(normalizedQuery)) {
        results.push({
          text: query,
          pageNumber: 1,
          position: { x: 0, y: 0 },
          context: `Header: ${header}`,
        });
      }
    }

    // Search in rows
    for (let rowIndex = 0; rowIndex < this.csvData.rows.length; rowIndex++) {
      const row = this.csvData.rows[rowIndex];
      if (!row) continue;
      
      for (let colIndex = 0; colIndex < row.length; colIndex++) {
        const cell = row[colIndex] || '';
        if (cell.toLowerCase().includes(normalizedQuery)) {
          const header = this.csvData.headers[colIndex] || `Column ${colIndex + 1}`;
          results.push({
            text: query,
            pageNumber: 1,
            position: { x: colIndex, y: rowIndex },
            context: `Row ${rowIndex + 1}, ${header}: ${cell}`,
          });
        }
      }
    }

    return results;
  }

  /**
   * Get row count
   */
  getRowCount(): number {
    return this.csvData.rows.length;
  }

  /**
   * Get column count
   */
  getColumnCount(): number {
    if (this.csvData.headers.length > 0) {
      return this.csvData.headers.length;
    }
    return this.csvData.rows[0]?.length || 0;
  }

  /**
   * Get headers
   */
  getHeaders(): string[] {
    return [...this.csvData.headers];
  }

  /**
   * Get raw data
   */
  getData(): CSVData {
    return {
      headers: [...this.csvData.headers],
      rows: this.csvData.rows.map(row => [...row]),
    };
  }

  /**
   * Cleanup resources
   */
  protected cleanup(): void {
    this.csvData = { headers: [], rows: [] };
  }
}
