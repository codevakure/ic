/**
 */

import {H} from '../../util/H';
import type {Workbook} from '../Workbook';

export type ScrollBarOptions = {
  /**
   */
  autoHide: boolean;

  scrollBarSize: number;
};

const defaultOptions: ScrollBarOptions = {
  autoHide: true,
  scrollBarSize: 15
};

export class ScrollBar {
  /**
   */
  container: HTMLElement;

  /**
   */
  workbook: Workbook;

  /**
   */
  yScrollBarTruck: HTMLElement;

  /**
   */
  yScrollBarTotal: HTMLElement;

  /**
   */
  yScrollBarContent: HTMLElement;

  /**
   */
  xScrollBarTruck: HTMLElement;

  /**
   */
  xScrollBarTotal: HTMLElement;

  /**
   */
  xScrollBarContent: HTMLElement;

  /**
   */
  scrollOptions: ScrollBarOptions;

  constructor(
    container: HTMLElement,
    workbook: Workbook,
    scrollOptions?: Partial<ScrollBarOptions>
  ) {
    this.container = container;
    this.workbook = workbook;

    this.scrollOptions = {...defaultOptions, ...scrollOptions};
    workbook.uiEvent.on('AFTER_SCROLL', () => {
      this.sync();
    });
    workbook.uiEvent.on('SWITCH_SHEET', () => {
      this.sync();
    });

    const scrollBarSize = this.scrollOptions.scrollBarSize;

    container.style.position = 'relative';

    const yScrollBarContent = H('div', {
      className: 'ov-excel-scrollbar-content-y',
      style: {
        width: `${scrollBarSize}px`
      }
    });

    this.yScrollBarContent = yScrollBarContent;

    yScrollBarContent.addEventListener('scroll', event => {
      const currentSheet = this.workbook.getActiveSheet();
      const sheetScrollTop = currentSheet.getScrollTop();
      const scrollBarTop = yScrollBarContent.scrollTop;
      if (Math.round(sheetScrollTop) !== Math.round(scrollBarTop)) {
        currentSheet.setScrollTop(yScrollBarContent.scrollTop);
        this.workbook.uiEvent.emit('SCROLL_Y', yScrollBarContent.scrollTop);
      }

      event.preventDefault();
      event.stopPropagation();
    });

    // [comment removed]
    yScrollBarContent.addEventListener('mousedown', event => {
      event.stopPropagation();
    });

    const yScrollBarTotal = H('div', {
      className: 'ov-excel-scrollbar-total-y',
      style: {
        width: `${scrollBarSize}px`
      },
      parent: yScrollBarContent
    });
    this.yScrollBarTotal = yScrollBarTotal;

    const yScrollBarTruck = H(
      'div',
      {
        className: 'ov-excel-scrollbar-y',
        style: {
          width: `${scrollBarSize}px`
        },
        parent: container
      },
      yScrollBarContent
    );

    this.yScrollBarTruck = yScrollBarTruck;

    const xScrollBarContent = H('div', {
      className: 'ov-excel-scrollbar-content-x',
      style: {
        height: `${scrollBarSize}px`
      }
    });
    this.xScrollBarContent = xScrollBarContent;

    xScrollBarContent.addEventListener('scroll', event => {
      const currentSheet = this.workbook.getActiveSheet();
      const sheetScrollLeft = currentSheet.getScrollLeft();
      const scrollBarLeft = xScrollBarContent.scrollLeft;
      if (Math.round(sheetScrollLeft) !== Math.round(scrollBarLeft)) {
        currentSheet.setScrollLeft(xScrollBarContent.scrollLeft);
        this.workbook.uiEvent.emit('SCROLL_X', xScrollBarContent.scrollLeft);
      }
      event.preventDefault();
      event.stopPropagation();
    });

    // [comment removed]
    xScrollBarContent.addEventListener('mousedown', event => {
      event.stopPropagation();
    });

    const xScrollBarTotal = H('div', {
      className: 'ov-excel-scrollbar-total-x',
      style: {
        height: `${scrollBarSize}px`
      },
      parent: xScrollBarContent
    });
    this.xScrollBarTotal = xScrollBarTotal;

    const xScrollBarTruck = H(
      'div',
      {
        className: 'ov-excel-scrollbar-x',
        style: {
          height: `${scrollBarSize}px`
        },
        parent: container
      },
      xScrollBarContent
    );
    this.xScrollBarTruck = xScrollBarTruck;

    this.sync();
  }

  /**
   */
  sync() {
    const currentSheet = this.workbook.getActiveSheet();
    const scrollBarSize = this.scrollOptions.scrollBarSize;
    const {width, height} = this.workbook.getViewpointSize();
    const scrollLeft = currentSheet.getScrollLeft();
    const scrollTop = currentSheet.getScrollTop();
    const {rowHeaderWidth, colHeaderHeight} = currentSheet.getRowColSize();

    this.xScrollBarContent.style.width = `${width}px`;
    this.yScrollBarContent.style.height = `${height}px`;

    const totalWidth = Math.max(
      width + scrollLeft,
      currentSheet.getTotalWidth() + rowHeaderWidth + scrollBarSize
    );
    const totalHeight = Math.max(
      height + scrollTop,
      currentSheet.getTotalHeight() + colHeaderHeight + scrollBarSize
    );

    if (totalWidth <= width) {
      this.xScrollBarTruck.style.display = 'none';
    } else {
      this.xScrollBarTruck.style.display = 'block';
    }

    if (totalHeight <= height) {
      this.yScrollBarTruck.style.display = 'none';
    } else {
      this.yScrollBarTruck.style.display = 'block';
    }

    this.xScrollBarTotal.style.width = `${totalWidth}px`;

    this.xScrollBarContent.scrollLeft = scrollLeft;

    this.yScrollBarTotal.style.height = `${totalHeight}px`;

    this.yScrollBarContent.scrollTop = scrollTop;
  }
}
