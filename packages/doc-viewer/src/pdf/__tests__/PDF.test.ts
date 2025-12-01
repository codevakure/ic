/**
 * PDF Viewer Tests
 */

import { test, describe, beforeEach, afterEach, it, expect } from 'vitest';
import { PDF } from '../PDF';

describe('PDF', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it('should create PDF instance', () => {
    const buffer = new ArrayBuffer(0);
    const pdf = new PDF(buffer);
    expect(pdf).toBeDefined();
  });

  it('should accept options', () => {
    const buffer = new ArrayBuffer(0);
    const options = {
      initialPage: 2,
      scale: 2.0,
      enableTextLayer: false
    };
    const pdf = new PDF(buffer, options);
    expect(pdf).toBeDefined();
  });

  it('should return current page', () => {
    const buffer = new ArrayBuffer(0);
    const pdf = new PDF(buffer, { initialPage: 3 });
    expect(pdf.getCurrentPage()).toBe(3);
  });

  it('should return current scale', () => {
    const buffer = new ArrayBuffer(0);
    const pdf = new PDF(buffer, { scale: 2.5 });
    expect(pdf.getScale()).toBe(2.5);
  });

  it('should destroy properly', () => {
    const buffer = new ArrayBuffer(0);
    const pdf = new PDF(buffer);
    pdf.destroy();
    expect(pdf.getTotalPages()).toBe(0);
  });
});
