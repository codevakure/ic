import React, { useEffect, useRef, useState } from 'react';
import Word from '../Word';
import Excel from '../Excel';
import { PDF } from '../pdf/PDF';
import { createOfficeViewer } from '../createOfficeViewer';
import { OfficeViewer } from '../OfficeViewer';

export interface DocumentViewerProps {
  /**
   * Document URL (e.g., S3 link) or ArrayBuffer
   */
  file: string | ArrayBuffer;
  
  /**
   * Document type - auto-detected if not provided
   */
  type?: 'docx' | 'xlsx' | 'pptx' | 'pdf' | 'auto';
  
  /**
   * Optional filename for better type detection
   */
  fileName?: string;
  
  /**
   * Custom render options based on document type
   */
  options?: any;
  
  /**
   * Callback when document loads successfully
   */
  onLoad?: () => void;
  
  /**
   * Callback when an error occurs
   */
  onError?: (error: Error) => void;
  
  /**
   * Custom class name for the container
   */
  className?: string;
  
  /**
   * Custom styles for the container
   */
  style?: React.CSSProperties;
}

export const DocumentViewer: React.FC<DocumentViewerProps> = ({
  file,
  type = 'auto',
  fileName,
  options = {},
  onLoad,
  onError,
  className = '',
  style = {},
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<OfficeViewer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let mounted = true;
    
    const loadAndRender = async () => {
      if (!containerRef.current) return;
      
      try {
        setLoading(true);
        setError(null);
        
        // Fetch file if URL is provided
        let arrayBuffer: ArrayBuffer;
        if (typeof file === 'string') {
          const response = await fetch(file);
          if (!response.ok) {
            throw new Error(`Failed to fetch document: ${response.statusText}`);
          }
          arrayBuffer = await response.arrayBuffer();
        } else {
          arrayBuffer = file;
        }
        
        if (!mounted) return;
        
        // Create viewer based on type
        let viewer: OfficeViewer | null = null;
        let pdfViewer: PDF | null = null;
        
        if (type === 'auto') {
          viewer = await createOfficeViewer(arrayBuffer, options, fileName);
        } else if (type === 'docx') {
          viewer = new Word(arrayBuffer, options);
        } else if (type === 'xlsx' || type === 'pptx') {
          viewer = new Excel(arrayBuffer, fileName, options);
        } else if (type === 'pdf') {
          // PDF uses different interface
          pdfViewer = new PDF(arrayBuffer, options);
          await pdfViewer.render(containerRef.current);
          setLoading(false);
          onLoad?.();
          return;
        } else {
          throw new Error(`Unsupported document type: ${type}`);
        }
        
        if (!mounted) return;
        
        // Render the document
        if (viewer) {
          await viewer.render(containerRef.current, options);
        }
        
        if (!mounted) return;
        
        viewerRef.current = viewer;
        setLoading(false);
        onLoad?.();
        
      } catch (err) {
        if (!mounted) return;
        
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        setLoading(false);
        onError?.(error);
      }
    };
    
    loadAndRender();
    
    return () => {
      mounted = false;
      if (viewerRef.current) {
        viewerRef.current.destroy();
        viewerRef.current = null;
      }
    };
  }, [file, type, fileName, options, onLoad, onError]);

  return (
    <div className={className} style={style}>
      {loading && (
        <div style={{ padding: '20px', textAlign: 'center' }}>
          Loading document...
        </div>
      )}
      {error && (
        <div style={{ padding: '20px', color: '#d32f2f' }}>
          Error loading document: {error.message}
        </div>
      )}
      <div 
        ref={containerRef} 
        style={{ 
          width: '100%', 
          height: '100%',
          display: loading || error ? 'none' : 'block'
        }} 
      />
    </div>
  );
};

export default DocumentViewer;
