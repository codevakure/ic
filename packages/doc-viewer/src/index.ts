import Word from './Word';
import Excel from './Excel';
import PDF from './pdf';
import { PPTXViewer } from './viewers/PPTXViewer';
import { createOfficeViewer } from './createOfficeViewer';

// Re-export third-party libraries for unified API
export { renderAsync as renderDocx } from 'docx-preview';
export { init as renderPptx } from 'pptx-preview';

// Import CSS for bundling
import './styles/viewer.css';
import './styles/excel.css';

// React component exports
export { DocumentViewer } from './react';
export type { DocumentViewerProps } from './react';

export { Word, Excel, PDF, PPTXViewer, createOfficeViewer };
export type { PDFOptions } from './pdf';
export type { OfficeViewer } from './OfficeViewer';
export type { WordRenderOptions } from './Word';
export type { PPTXOptions } from './viewers/PPTXViewer';

// Named export object for backwards compatibility
export const DocViewer = { Word, Excel, PDF, PPTXViewer };
