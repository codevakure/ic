import {Rect} from '../Rect';

/**
 */
export class BaseDrawingRender {
  drawingContainer: HTMLElement;

  constructor(
    container: HTMLElement,
    displayRect: Rect,
    gid: string,
    className: string
  ) {
    const picContainer = document.createElement('div');
    picContainer.className = className;
    picContainer.dataset.gid = gid;
    // Let CSS handle positioning and z-index via classes
    picContainer.style.position = 'absolute';
    picContainer.style.overflow = 'hidden';
    picContainer.style.zIndex = '10';
    picContainer.style.pointerEvents = 'auto';
    
    this.drawingContainer = picContainer;
    this.updatePosition(displayRect);
    container.appendChild(picContainer);
    
    console.log('[BaseDrawingRender] Creating container:', {
      gid,
      className,
      displayRect
    });
    console.log('[BaseDrawingRender] Container appended, parent:', container.className);
  }

  hide() {
    this.drawingContainer.style.display = 'none';
  }

  show() {
    this.drawingContainer.style.display = 'block';
  }

  updatePosition(displayRect: Rect) {
    const {x, y, width, height} = displayRect;
    this.drawingContainer.style.left = `${x}px`;
    this.drawingContainer.style.top = `${y}px`;
    this.drawingContainer.style.width = `${width}px`;
    this.drawingContainer.style.height = `${height}px`;
  }
}
