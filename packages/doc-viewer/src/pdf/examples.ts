/**
 * PDF Viewer Example Usage
 * 
 * This file demonstrates how to use the PDF viewer in LibreChat
 */

import { PDF, PDFOptions } from './index';
// import '@librechat/document-viewer/dist/office.css'; // Uncomment when using as installed package

// Example 1: Basic PDF rendering
async function basicPDFExample(pdfData: ArrayBuffer, container: HTMLElement) {
  const pdf = new PDF(pdfData);
  await pdf.render(container);
}

// Example 2: PDF with custom options
async function customPDFExample(pdfData: ArrayBuffer, container: HTMLElement) {
  const options: PDFOptions = {
    initialPage: 1,
    scale: 1.5,
    enableTextLayer: true,
    enableAnnotations: false,
    maxWidth: 1200,
    onLoad: (totalPages) => {
      console.log(`PDF loaded with ${totalPages} pages`);
    },
    onPageChange: (currentPage, totalPages) => {
      console.log(`Page ${currentPage} of ${totalPages}`);
    },
    onError: (error) => {
      console.error('PDF Error:', error);
    }
  };

  const pdf = new PDF(pdfData, options);
  await pdf.render(container);

  return pdf;
}

// Example 3: Programmatic navigation
async function navigationExample(pdfData: ArrayBuffer, container: HTMLElement) {
  const pdf = new PDF(pdfData, {
    initialPage: 1,
    scale: 1.0
  });

  await pdf.render(container);

  // Navigate to specific page
  await pdf.goToPage(5);

  // Go to next page
  await pdf.nextPage();

  // Go to previous page
  await pdf.previousPage();

  // Get current state
  console.log('Current page:', pdf.getCurrentPage());
  console.log('Total pages:', pdf.getTotalPages());
  console.log('Current scale:', pdf.getScale());

  return pdf;
}

// Example 4: Zoom controls
async function zoomExample(pdfData: ArrayBuffer, container: HTMLElement) {
  const pdf = new PDF(pdfData);
  await pdf.render(container);

  // Zoom in
  await pdf.zoomIn();

  // Zoom out
  await pdf.zoomOut();

  // Fit to width
  await pdf.fitToWidth();

  return pdf;
}

// Example 5: Loading from file upload
async function fileUploadExample() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.pdf';

  input.onchange = async (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;

    const arrayBuffer = await file.arrayBuffer();
    const container = document.getElementById('pdf-container') as HTMLElement;

    const pdf = new PDF(arrayBuffer, {
      onLoad: (totalPages) => {
        console.log(`Loaded ${file.name}: ${totalPages} pages`);
      },
      onError: (error) => {
        alert(`Error loading PDF: ${error.message}`);
      }
    });

    await pdf.render(container);
  };

  input.click();
}

// Example 6: Loading from URL
async function urlLoadExample(url: string, container: HTMLElement) {
  try {
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();

    const pdf = new PDF(arrayBuffer, {
      scale: 1.2,
      enableTextLayer: true
    });

    await pdf.render(container);
    return pdf;
  } catch (error) {
    console.error('Failed to load PDF from URL:', error);
    throw error;
  }
}

// Example 7: Cleanup and destroy
async function cleanupExample(pdfData: ArrayBuffer, container: HTMLElement) {
  const pdf = new PDF(pdfData);
  await pdf.render(container);

  // ... use the PDF viewer ...

  // When done, cleanup resources
  pdf.destroy();
}

// Example 8: React integration example
/*
import React, { useEffect, useRef, useState } from 'react';
import { PDF } from '@librechat/document-viewer';
import '@librechat/document-viewer/dist/office.css';

interface PDFViewerProps {
  data: ArrayBuffer;
  initialPage?: number;
  onPageChange?: (page: number, total: number) => void;
}

const PDFViewer: React.FC<PDFViewerProps> = ({ data, initialPage, onPageChange }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const pdfRef = useRef<PDF | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const pdf = new PDF(data, {
      initialPage,
      onLoad: () => setIsLoading(false),
      onPageChange,
      onError: (err) => setError(err.message)
    });

    pdf.render(containerRef.current);
    pdfRef.current = pdf;

    return () => {
      pdf.destroy();
    };
  }, [data, initialPage, onPageChange]);

  if (error) {
    return <div className="pdf-error">Error: {error}</div>;
  }

  if (isLoading) {
    return <div className="pdf-loading">Loading PDF...</div>;
  }

  return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />;
};

export default PDFViewer;
*/

export {
  basicPDFExample,
  customPDFExample,
  navigationExample,
  zoomExample,
  fileUploadExample,
  urlLoadExample,
  cleanupExample
};
