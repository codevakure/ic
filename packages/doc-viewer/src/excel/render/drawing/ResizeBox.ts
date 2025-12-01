import {H} from '../../../util/H';

/**
 */
export class ResizeBox {
  /**
   */
  box: HTMLElement;

  /**
   */
  topLeft: HTMLElement;

  /**
   */
  top: HTMLElement;

  /**
   */
  topRight: HTMLElement;

  /**
   */
  left: HTMLElement;

  /**
   */
  right: HTMLElement;

  /**
   */
  bottomLeft: HTMLElement;

  /**
   */
  bottom: HTMLElement;

  /**
   */
  bottomRight: HTMLElement;

  /**
   */
  controllerSize = 14;

  constructor(container: HTMLElement) {
    this.box = H('div', {
      className: 'ov-excel-resize-box',
      parent: container
    });

    this.topLeft = H('div', {
      className: 'ov-excel-resize-box-control',
      parent: this.box
    });

    this.top = H('div', {
      className: 'ov-excel-resize-box-control',
      parent: this.box
    });

    this.topRight = H('div', {
      className: 'ov-excel-resize-box-control',
      parent: this.box
    });

    this.left = H('div', {
      className: 'ov-excel-resize-box-control',
      parent: this.box
    });

    this.right = H('div', {
      className: 'ov-excel-resize-box-control',
      parent: this.box
    });

    this.bottomLeft = H('div', {
      className: 'ov-excel-resize-box-control',
      parent: this.box
    });

    this.bottom = H('div', {
      className: 'ov-excel-resize-box-control',
      parent: this.box
    });

    this.bottomRight = H('div', {
      className: 'ov-excel-resize-box-control',
      parent: this.box
    });

    // [comment removed]
    this.hide();
  }

  /**
   */
  updatePosition(x: number, y: number, width: number, height: number) {
    this.box.style.display = 'block';
    this.box.style.left = `${x}px`;
    this.box.style.top = `${y}px`;
    this.box.style.width = `${width}px`;
    this.box.style.height = `${height}px`;

    this.topLeft.style.left = '-7px';
    this.topLeft.style.top = '-7px';

    this.top.style.left = `${width / 2 - this.controllerSize / 2}px`;
    this.top.style.top = '-7px';

    this.topRight.style.right = '-7px';
    this.topRight.style.top = '-7px';

    this.left.style.left = '-7px';
    this.left.style.top = `${height / 2 - this.controllerSize / 2}px`;

    this.right.style.right = '-7px';
    this.right.style.top = `${height / 2 - this.controllerSize / 2}px`;

    this.bottomLeft.style.left = '-7px';
    this.bottomLeft.style.bottom = '-7px';

    this.bottom.style.left = `${width / 2 - this.controllerSize / 2}px`;
    this.bottom.style.bottom = '-7px';

    this.bottomRight.style.right = '-7px';
    this.bottomRight.style.bottom = '-7px';
  }

  hide() {
    this.box.style.display = 'none';
  }
}
