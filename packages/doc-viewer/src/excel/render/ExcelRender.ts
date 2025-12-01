/**
 */

import type {Workbook} from '../Workbook';
import {ScrollBar} from './ScrollBar';
import {Sheet} from '../sheet/Sheet';
import {SheetCanvas} from './SheetCanvas';
import type {ExcelRenderOptions} from '../sheet/ExcelRenderOptions';

import {throttle} from '../../util/throttle';
import {IDataProvider} from '../types/IDataProvider';
import {FontSize} from '../types/FontSize';
import {drawGridLines} from './grid/drawGridLines';
import {drawCells} from './cell/drawCells';
import {drawRowColHeaders} from './header/drawRowColHeaders';
import {debounce} from '../../util/debounce';
import {drawFrozen} from './cell/frozen/drawFrozen';
import {SelectionCanvas} from './SelectionCanvas';
import {updateCursor} from './selection/updateCursor';
import {dragState, handleMousedown} from './dnd/handleMousedown';
import {Scroll} from './scroll/Scroll';
import {drawDrawing} from './drawing/drawDrawing';
import {drawSparkline} from './sparkline/drawSparkline';
import {isValidURL} from '../../util/isValidURL';
import {LinkPosition} from './cell/LinkPosition';
import {isPointerOnLink} from './cell/isPointerOnLink';
import {ResizeBox} from './drawing/ResizeBox';
import {renderAutoFilter} from './autoFilter/renderAutoFilter';
import {AutoFilterIconUI} from './autoFilter/AutoFilterIconUI';
import {getMouseRelativePosition} from './dnd/getMouseRelativePosition';
import {CellEditor} from '../edit/ui/CellEditor';
import {getAllNotAvailableFont} from './cell/checkFont';
import {inValidTextSizeCache} from './cell/measureTextWithCache';

export class ExcelRender {
  /**
   */
  private contentContainer: HTMLElement;

  /**
   */
  private dataContainer: HTMLElement;

  private workbook: Workbook;

  /**
   */
  private sheetCanvas: SheetCanvas;

  /**
   */
  private selectionCanvas: SelectionCanvas;

  /**
   */
  scrollbar: ScrollBar;

  /**
   */
  resizeBox: ResizeBox;

  renderOptions: ExcelRenderOptions;

  dataProvider: IDataProvider;

  /**
   */
  defaultFontSize: FontSize;

  /**
   */
  lastScroll: Scroll = {left: 0, top: 0};

  linkPositionCache: LinkPosition[] = [];

  autoFiltersUI: AutoFilterIconUI[] = [];

  constructor(
    contentContainer: HTMLElement,
    dataContainer: HTMLElement,
    workbook: Workbook,
    dataProvider: IDataProvider,
    renderOptions: ExcelRenderOptions
  ) {
    this.contentContainer = contentContainer;

    this.dataContainer = dataContainer;
    this.workbook = workbook;
    this.renderOptions = renderOptions;

    this.contentContainer.addEventListener(
      'wheel',
      this.handleWheel.bind(this),
      {
        passive: false
      }
    );

    this.contentContainer.addEventListener(
      'mousedown',
      this.handleMousedown.bind(this)
    );

    this.contentContainer.addEventListener(
      'mouseup',
      this.handleMouseup.bind(this)
    );

    this.contentContainer.addEventListener(
      'touchstart',
      this.handleMousedown.bind(this)
    );

    // [comment removed]
    this.handleMousemove = debounce(this.handleMousemove, 16);
    this.contentContainer.addEventListener(
      'mousemove',
      this.handleMousemove.bind(this)
    );

    this.dataContainer.addEventListener(
      'dblclick',
      this.handleDblclick.bind(this)
    );

    this.sheetCanvas = new SheetCanvas(workbook, dataProvider);
    const sheetCanvasElement = this.sheetCanvas.getCanvasElement();

    this.contentContainer.appendChild(sheetCanvasElement);

    this.selectionCanvas = new SelectionCanvas(workbook, dataProvider);
    this.contentContainer.appendChild(this.selectionCanvas.getCanvasElement());

    this.scrollbar = new ScrollBar(contentContainer, workbook);

    this.resizeBox = new ResizeBox(contentContainer);

    this.defaultFontSize = dataProvider.getDefaultFontSize();
    this.dataProvider = dataProvider;

    this.draw = this.draw.bind(this);

    workbook.uiEvent.on('SWITCH_SHEET', (sheet: Sheet) => {
      // [comment removed]
      this.dataContainer.innerHTML = '';

      this.draw();
    });

    workbook.uiEvent.on('CHANGE_ZOOM_LEVEL', scale => {
      this.sheetCanvas.updateZoom(scale);
      this.selectionCanvas.updateZoom(scale);
      this.draw();
      this.selectionCanvas.draw();
    });

    workbook.uiEvent.on('SCROLL_X', (x: number) => {
      this.workbook.getActiveSheet().setScrollLeft(x);
      this.draw();
    });

    workbook.uiEvent.on('SCROLL_Y', (y: number) => {
      this.workbook.getActiveSheet().setScrollTop(y);
      this.draw();
    });

    workbook.uiEvent.on('APPLY_AUTO_FILTER', (sheetIndex: number) => {
      const currentSheetIndex = this.workbook.getActiveSheet().getIndex();
      if (currentSheetIndex === sheetIndex) {
        this.draw();
      }
    });

    workbook.uiEvent.on('UPDATE_RANGE', (sheetIndex: number) => {
      // [comment removed]
      const currentSheetIndex = this.workbook.getActiveSheet().getIndex();
      if (currentSheetIndex === sheetIndex) {
        this.draw();
      }
    });

    workbook.uiEvent.on('UPDATE_ROW_HEIGHT', (row: number, height: number) => {
      this.draw();
    });

    workbook.uiEvent.on('UPDATE_COL_WIDTH', (col: number, width: number) => {
      this.draw();
    });

    this.watchResize();
  }

  lastScrollDirection: 'vertical' | 'horizontal' = 'vertical';

  lastScrollDirectionTime = 0;

  scrollDirectionLockTime = 100;

  getSelectionCanvas() {
    return this.selectionCanvas;
  }

  watchResize() {
    const contentContainer = this.contentContainer;
    // [comment removed]
    let lastWidth = contentContainer.clientWidth;
    let lastHeight = contentContainer.clientHeight;
    const containerObserver = new ResizeObserver(entries => {
      const entry = entries[0];
      const {width, height} = entry.contentRect;
      if (
        Math.floor(lastWidth) === Math.floor(width) &&
        Math.floor(lastHeight) === Math.floor(height)
      ) {
        return;
      }
      lastWidth = width;
      lastHeight = height;
      this.draw();
    });

    containerObserver.observe(contentContainer);
  }

  /**
   */
  handleWheel(event: WheelEvent) {
    let {deltaX, deltaY, deltaMode} = event;
    const currentSheet = this.workbook.getActiveSheet();
    // [comment removed]
    const isScrollingHorizontally =
      event.shiftKey || Math.abs(deltaX) > Math.abs(deltaY);

    event.preventDefault();
    event.stopPropagation();
    if (this.ignoreScrollDirection(isScrollingHorizontally)) {
      return false;
    }

    deltaX = Math.floor(deltaX);
    deltaY = Math.floor(deltaY);

    // [comment removed]
    if (isScrollingHorizontally) {
      currentSheet.deltaScrollLeft(deltaX);
    } else {
      currentSheet.deltaScrollTop(deltaY);
    }

    const scroll = {
      left: Math.floor(currentSheet.getScrollLeft()),
      top: Math.floor(currentSheet.getScrollTop())
    };

    if (
      this.lastScroll.left !== scroll.left ||
      this.lastScroll.top !== scroll.top
    ) {
      this.lastScroll = scroll;
      this.draw();
      // [comment removed]
      this.afterScroll(scroll);
    }

    return false;
  }

  /**
   */
  handleDblclick(event: MouseEvent) {
    if (this.renderOptions.editable === false) {
      return;
    }
    const {offsetX, offsetY} = this.getMouseRelativePosition(event);

    const hitTestResult = this.workbook
      .getActiveSheet()
      .hitTest(offsetX, offsetY);

    if (hitTestResult && hitTestResult.type === 'cell') {
      new CellEditor(this.dataContainer, this.workbook, hitTestResult);
    }
  }

  /**
   */
  handleMousedown(event: MouseEvent) {
    let {offsetX, offsetY} = this.getMouseRelativePosition(event);

    const hitTestResult = this.workbook
      .getActiveSheet()
      .hitTest(offsetX, offsetY);

    if (hitTestResult) {
      handleMousedown(
        this.workbook,
        hitTestResult,
        this.contentContainer,
        event
      );
    }
  }

  /**
   */
  handleMouseup(event: MouseEvent) {
    // [comment removed]
    if (dragState.isDragging) {
      return;
    }
    let {offsetX, offsetY} = this.getMouseRelativePosition(event);

    const pointerOnLink = isPointerOnLink(
      offsetX,
      offsetY,
      this.linkPositionCache
    );

    if (pointerOnLink) {
      window.open(pointerOnLink);
    }

    const hitTestResult = this.workbook
      .getActiveSheet()
      .hitTest(offsetX, offsetY);

    this.resizeBox.hide();

    if (hitTestResult) {
      if (hitTestResult.type === 'drawing') {
        this.selectionCanvas.clearSelection();
        this.resizeBox.updatePosition(
          hitTestResult.x,
          hitTestResult.y,
          hitTestResult.width,
          hitTestResult.height
        );
      }
    }
  }

  /**
   */
  handleMousemove(event: MouseEvent) {
    // [comment removed]
    if (dragState.isDragging) {
      return;
    }

    let {offsetX, offsetY} = this.getMouseRelativePosition(event);

    offsetX = Math.round(offsetX);
    offsetY = Math.round(offsetY);

    // [comment removed]
    this.contentContainer.style.cursor = 'cell';
    const hitTestResult = this.workbook
      .getActiveSheet()
      .hitTest(offsetX, offsetY);

    // [comment removed]
    if (this.renderOptions.debug) {
      this.renderOptions.mousePositionTracker?.(
        offsetX,
        offsetY,
        hitTestResult
      );
    }

    // [comment removed]
    const pointerOnLink = isPointerOnLink(
      offsetX,
      offsetY,
      this.linkPositionCache
    );

    updateCursor(this.contentContainer, hitTestResult, pointerOnLink);
  }

  /**
   */
  getMouseRelativePosition(event: MouseEvent) {
    let {offsetX, offsetY} = getMouseRelativePosition(
      this.contentContainer,
      event
    );
    const zoomLevel = this.workbook.getActiveSheet().getZoomLevel();
    offsetX = offsetX / zoomLevel;
    offsetY = offsetY / zoomLevel;
    return {offsetX, offsetY};
  }

  /**
   * @param isScrollingHorizontally
   */
  ignoreScrollDirection(isScrollingHorizontally: boolean) {
    // [comment removed]
    if (
      Date.now() - this.lastScrollDirectionTime <
      this.scrollDirectionLockTime
    ) {
      if (
        this.lastScrollDirection === 'horizontal' &&
        !isScrollingHorizontally
      ) {
        return true;
      }
      if (this.lastScrollDirection === 'vertical' && isScrollingHorizontally) {
        return true;
      }
    }
    this.lastScrollDirection = isScrollingHorizontally
      ? 'horizontal'
      : 'vertical';
    this.lastScrollDirectionTime = Date.now();
    return false;
  }

  afterScroll(scroll: Scroll) {
    this.workbook.uiEvent.emit('AFTER_SCROLL', scroll);
  }

  /**
   */
  getWidthAndHeight() {
    const {width, height} = this.workbook.getViewpointSize();
    return {
      width,
      height
    };
  }

  /**
   */
  needReDraw: boolean | number = false;

  /**
   */
  async draw(fromReRender = false) {
    const startDraw = performance.now();

    const mainCanvas = this.sheetCanvas;
    const currentSheet = this.workbook.getActiveSheet();
    const {width, height} = this.getWidthAndHeight();

    this.linkPositionCache = [];

    // [comment removed]
    const viewRange = currentSheet.getViewPointRange(width, height);
    this.workbook.getActiveSheet().updateViewRange(viewRange);

    // [comment removed]
    const displayData = currentSheet.getViewPointData(viewRange);

    mainCanvas.clear();

    // [comment removed]
    currentSheet.updateRowHeaderWidth(viewRange);

    // [comment removed]
    drawGridLines(
      currentSheet,
      viewRange,
      mainCanvas,
      height,
      width,
      this.renderOptions
    );

    // [comment removed]
    drawSparkline(currentSheet, viewRange, mainCanvas);

    // [comment removed]
    drawCells(
      this,
      currentSheet,
      this.renderOptions,
      mainCanvas,
      displayData,
      this.linkPositionCache
    );

    // [comment removed]
    renderAutoFilter(currentSheet, this.dataContainer);

    // [comment removed]
    drawDrawing(this, currentSheet, viewRange, mainCanvas);

    // [comment removed]
    drawRowColHeaders(
      currentSheet,
      viewRange,
      mainCanvas,
      this.renderOptions,
      this.defaultFontSize,
      this.dataProvider.getDefaultFontStyle()
    );

    // [comment removed]
    const frozenViewRange = drawFrozen(
      this,
      currentSheet,
      this.dataProvider,
      this.renderOptions,
      mainCanvas,
      height,
      width,
      this.linkPositionCache
    );

    this.workbook.getActiveSheet().updateFrozenViewRange(frozenViewRange);


    // [comment removed]
    await this.loadFont();

    if (this.needReDraw && fromReRender === false) {
      this.needReDraw = false;
      // [comment removed]
      this.draw(true);
    }
  }

  /**
   */
  loadedFont: Set<string> = new Set();

  /**
   */
  async loadFont() {
    const fontURL = this.renderOptions.fontURL;
    const notAvailableFonts = getAllNotAvailableFont();
    let needReDraw = false;
    for (const font of notAvailableFonts) {
      if (this.loadedFont.has(font)) {
        continue;
      }
      if (font in fontURL) {
        this.loadedFont.add(font);
        const fontFace = new FontFace(font, `url(${fontURL[font]})`);
        await fontFace.load();
        document.fonts.add(fontFace);
        needReDraw = true;
      } else {
        console.warn('font not found', font);
      }
    }
    if (needReDraw) {
      // [comment removed]
      inValidTextSizeCache();
      const currentSheet = this.workbook.getActiveSheet();
      currentSheet.clearFontCache();
      this.setNeedReDraw();
    }
  }

  setNeedReDraw() {
    const now = new Date().getTime();
    if (this.needReDraw) {
      // [comment removed]
      if (now - (this.needReDraw as number) < 100) {
        return;
      }
    }

    this.needReDraw = new Date().getTime();
  }

  /**
   */
  destroy() {
    this.contentContainer.removeEventListener('wheel', this.handleWheel);
    this.contentContainer.removeEventListener(
      'mousedown',
      this.handleMousedown
    );
  }
}
