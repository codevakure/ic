# @librechat/doc-viewer

Enterprise-grade document viewer for DOCX, XLSX, PPTX, and PDF formats with full client-side rendering.

## Features

- 📄 **Word (DOCX)** - Complete OOXML parsing with styles, themes, tables, images
- 📊 **Excel (XLSX)** - Full workbook support with formulas, charts, conditional formatting
- 🎨 **PowerPoint (PPTX)** - Slide rendering with animations and transitions
- 📑 **PDF** - High-fidelity PDF rendering with text layer and annotations
- 🔒 **Client-Side** - All processing in browser, no server uploads required
- ⚡ **Performance** - Optimized for large documents with virtual scrolling
- 🎯 **Type-Safe** - Full TypeScript support with comprehensive types
- 🧩 **Modular** - Use only what you need, tree-shakeable

## Installation

```bash
npm install @librechat/doc-viewer
```

## Quick Start

### JavaScript/TypeScript

```typescript
import { WordViewer, ExcelViewer, PDFViewer } from '@librechat/doc-viewer';
// Import merged styles for centering, dark mode, and theme support
import '@librechat/doc-viewer/styles';

// Word Document
const wordViewer = new WordViewer(containerElement, {
  classPrefix: 'doc-',
  enableCopy: true,
});
await wordViewer.renderFile(arrayBuffer);

// Excel Workbook
const excelViewer = new ExcelViewer(containerElement, {
  showFormulaBar: true,
  enableEdit: false,
});
await excelViewer.renderFile(arrayBuffer);

// PDF Document
const pdfViewer = new PDFViewer(containerElement, {
  enableTextSelection: true,
  scale: 1.0,
});
await pdfViewer.renderFile(arrayBuffer);
```

### React

```tsx
import { useDocViewer } from '@librechat/doc-viewer/react';
import '@librechat/doc-viewer/styles';

function DocumentViewer({ file, type }) {
  const { containerRef, isLoading, error } = useDocViewer({
    file,
    type,
    options: {
      enableCopy: true,
      showToolbar: true,
    },
  });

  if (error) return <div>Error: {error.message}</div>;
  if (isLoading) return <div>Loading...</div>;
  
  return <div ref={containerRef} className="doc-viewer" />;
}
```

## Architecture

### Core Structure

```
@librechat/doc-viewer/
├── core/              # Core viewing engine
│   ├── DocumentViewer.ts
│   ├── RenderOptions.ts
│   └── types.ts
├── parsers/           # Format-specific parsers
│   ├── ooxml/        # Office Open XML parser
│   ├── pdf/          # PDF parser (pdfjs-dist)
│   └── zip/          # ZIP archive handler
├── renderers/         # Format-specific renderers
│   ├── word/         # Word HTML renderer
│   ├── excel/        # Excel Canvas renderer
│   ├── pptx/         # PowerPoint renderer
│   └── pdf/          # PDF Canvas renderer
├── features/          # Advanced features
│   ├── formulas/     # Excel formula engine
│   ├── charts/       # Chart rendering
│   ├── styles/       # Style engine
│   └── themes/       # Theme engine
└── utils/            # Shared utilities
```

## API Reference

### WordViewer

```typescript
class WordViewer {
  constructor(container: HTMLElement, options?: WordOptions);
  renderFile(data: ArrayBuffer): Promise<void>;
  destroy(): void;
  getText(): string;
  search(query: string): SearchResult[];
}

interface WordOptions {
  classPrefix?: string;
  enableCopy?: boolean;
  ignoreWidth?: boolean;
  ignoreHeight?: boolean;
  minLineHeight?: number;
  fontMapping?: Record<string, string>;
}
```

### ExcelViewer

```typescript
class ExcelViewer {
  constructor(container: HTMLElement, options?: ExcelOptions);
  renderFile(data: ArrayBuffer): Promise<void>;
  destroy(): void;
  getSheetNames(): string[];
  setActiveSheet(name: string): void;
  getCellValue(ref: string): any;
}

interface ExcelOptions {
  showFormulaBar?: boolean;
  enableEdit?: boolean;
  showGridLines?: boolean;
  enableFormulas?: boolean;
}
```

### PDFViewer

```typescript
class PDFViewer {
  constructor(container: HTMLElement, options?: PDFOptions);
  renderFile(data: ArrayBuffer): Promise<void>;
  destroy(): void;
  setScale(scale: number): void;
  goToPage(pageNumber: number): void;
  getPageCount(): number;
}

interface PDFOptions {
  scale?: number;
  enableTextSelection?: boolean;
  enableAnnotations?: boolean;
  renderTextLayer?: boolean;
}
```

## Advanced Usage

### Custom Rendering

```typescript
import { WordViewer, WordRenderer } from '@librechat/doc-viewer';

class CustomWordRenderer extends WordRenderer {
  renderParagraph(paragraph) {
    // Custom paragraph rendering
    return super.renderParagraph(paragraph);
  }
}

const viewer = new WordViewer(container, {
  renderer: new CustomWordRenderer(),
});
```

### Event Handling

```typescript
const viewer = new WordViewer(container);

viewer.on('load', () => {
  console.log('Document loaded');
});

viewer.on('error', (error) => {
  console.error('Error:', error);
});

viewer.on('pageChange', (pageNumber) => {
  console.log('Page:', pageNumber);
});
```

### Formula Calculation

```typescript
import { ExcelViewer, FormulaEngine } from '@librechat/doc-viewer';

const engine = new FormulaEngine();
engine.setCell('A1', 10);
engine.setCell('B1', 20);
const result = engine.calculate('=SUM(A1:B1)'); // 30
```

## Performance

- **Lazy Loading**: Only loads and renders visible pages
- **Virtual Scrolling**: Handles documents with thousands of pages
- **Worker Threads**: Offloads parsing to web workers
- **Caching**: Intelligent caching of parsed structures
- **Optimization**: Minimal DOM manipulation, efficient rendering

## Browser Support

- Chrome/Edge: ✅ Latest 2 versions
- Firefox: ✅ Latest 2 versions
- Safari: ✅ Latest 2 versions
- Mobile: ✅ iOS Safari, Chrome Mobile

## Dependencies

- `fflate` - Fast ZIP decompression (MIT)
- `pdfjs-dist` - PDF rendering (Apache 2.0)
- `numfmt` - Number formatting (Apache 2.0)

## License

Apache 2.0 - See LICENSE file

## Contributing

Contributions welcome! Please read CONTRIBUTING.md first.

## Credits

Inspired by the excellent work on [baidu/amis office-viewer](https://github.com/baidu/amis/tree/master/packages/office-viewer).
