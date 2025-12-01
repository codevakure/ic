/**
 */

import type {ExcelRenderOptions} from './sheet/ExcelRenderOptions';
import {EventEmitter} from '../util/EventEmitter';
import {StyleSheet} from './StyleSheet';
import {ExcelRender} from './render/ExcelRender';
import {Sheet} from './sheet/Sheet';
import {IDataProvider} from './types/IDataProvider';
import {SheetSelection} from './render/selection/SheetSelection';
import {Scroll} from './render/scroll/Scroll';
import {handleKeydown} from './render/keyboard/handleKeydown';
import {handlePaste} from './render/keyboard/handlePaste';
import {FormulaBar} from './render/formulaBar/FormulaBar';
import {SheetTabBar} from './render/sheetTab/SheetTabBar';
import {H} from '../util/H';
import {IWorkbook} from './types/IWorkbook';
import {EnKeys} from './lang/en_US';
import {getTranslate} from './lang/lang';
import {RangeRef} from './types/RangeRef';
import {MAX_COL, MAX_ROW} from './render/Consts';
import {rangeToHTML} from './render/selection/buildHTML/rangeToHTML';
import {printIframe} from '../util/print';
import {renderInIframe} from './print/renderInIframe';

export class Workbook {
  /**
   */
  container: HTMLElement;

  /**
   */
  formulaBarContainer?: HTMLElement;

  /**
   */
  contentContainer?: HTMLElement;

  /**
   */
  dataContainer?: HTMLElement;

  /**
   */
  sheetTabBarContainer?: HTMLElement;

  workbookData: IWorkbook;

  /**
   */
  dataProvider: IDataProvider;

  /**
   */
  private currentSheet?: Sheet;

  /**
   */
  sheets: Sheet[] = [];

  /**
   */
  styleSheet: StyleSheet;

  /**
   */
  renderOptions: ExcelRenderOptions;

  /**
   */
  formulaBar: FormulaBar;

  /**
   */
  excelRender: ExcelRender;

  /**
   */
  sheetTabBar: SheetTabBar;

  translator: (key: EnKeys) => string;

  /**
   */
  uiEvent = new EventEmitter<{
    /**
     */
    SCROLL_X: (x: number) => void;

    /**
     */
    SCROLL_Y: (y: number) => void;

    /**
     */
    AFTER_SCROLL: (scroll: Scroll) => void;

    /**
     */
    SWITCH_SHEET: (sheet: Sheet) => void;

    /**
     */
    CHANGE_SELECTION: (selection: SheetSelection) => void;

    /**
     */
    DRAG_ROW_GRID_LINE: (y: number) => void;

    /**
     */
    DRAG_COL_GRID_LINE: (x: number) => void;

    /**
     */
    DRAG_COL_GRID_LINE_END: (col: number, width: number) => void;

    /**
     */
    DRAG_ROW_GRID_LINE_END: (row: number, height: number) => void;

    /**
     */
    CHANGE_ZOOM_LEVEL: (zoomLevel: number) => void;

    /**
     */
    COPY_SELECTION: () => void;

    /**
     */
    APPLY_AUTO_FILTER: (sheetIndex: number) => void;

    /**
     */
    UPDATE_RANGE: (sheetIndex: number, rangeRef: RangeRef) => void;

    UPDATE_ROW_HEIGHT: (row: number, height: number) => void;

    UPDATE_COL_WIDTH: (col: number, width: number) => void;
  }>();

  constructor(
    container: HTMLElement,
    workbookData: IWorkbook,
    dataProvider: IDataProvider,
    renderOptions: ExcelRenderOptions,
    sheetName?: string
  ) {
    this.renderOptions = renderOptions;
    this.container = container;
    this.dataProvider = dataProvider;
    dataProvider.getSheets().forEach((sheetData, index) => {
      this.sheets.push(
        new Sheet(index, dataProvider, sheetData, this, renderOptions)
      );
    });

    this.workbookData = workbookData;

    this.initActiveSheet();

    this.initDom(container);

    // Formula bar
    this.formulaBar = new FormulaBar(
      this.formulaBarContainer!,
      this,
      renderOptions
    );

    this.styleSheet = new StyleSheet(dataProvider);
    this.excelRender = new ExcelRender(
      this.contentContainer!,
      this.dataContainer!,
      this,
      dataProvider,
      renderOptions
    );

    // Bottom sheet tab switcher
    this.sheetTabBar = new SheetTabBar(
      this.sheetTabBarContainer!,
      this,
      renderOptions
    );

    this.handleKeydown = this.handleKeydown.bind(this);
    document.addEventListener('keydown', this.handleKeydown);
    this.handlePaste = this.handlePaste.bind(this);
    document.addEventListener('paste', this.handlePaste);

    this.translator = getTranslate(this.renderOptions.locale);
  }

  initActiveSheet() {
    let activeTabIndex = 0;
    if (this.workbookData.workbookView?.activeTab) {
      activeTabIndex = this.workbookData.workbookView.activeTab;
    }
    this.currentSheet = this.sheets[activeTabIndex];
  }

  /**
   */
  initDom(container: HTMLElement) {
    // Clear container
    container.innerHTML = '';
    container.classList.add('ov-excel');

    if (this.renderOptions.showFormulaBar) {
      this.formulaBarContainer = H('div', {
        className: 'ov-excel-formula-bar',
        parent: container
      });
    }

    this.contentContainer = H('div', {
      className: 'ov-excel-content',
      parent: container
    });

    this.dataContainer = H('div', {
      className: 'ov-excel-data',
      parent: this.contentContainer
    });

    if (this.renderOptions.showSheetTabBar) {
      this.sheetTabBarContainer = H('div', {
        className: 'ov-excel-sheet-tab-bar',
        parent: container
      });
    }
  }

  /**
   */
  destroy() {
    document.removeEventListener('keydown', this.handleKeydown);
  }

  handleKeydown(e: KeyboardEvent) {
    handleKeydown(e, this);
  }

  handlePaste(e: ClipboardEvent) {
    handlePaste(e, this);
  }

  /**
   */
  render() {
    this.excelRender.draw();
  }

  /**
   */
  setActiveSheet(sheetName?: string) {
    if (!sheetName) {
      this.currentSheet = this.sheets[0];
      this.uiEvent.emit('SWITCH_SHEET', this.currentSheet);
    } else {
      for (const sheet of this.sheets) {
        if (sheet.getSheetName() === sheetName && this.currentSheet !== sheet) {
          this.currentSheet = sheet;
          this.uiEvent.emit('SWITCH_SHEET', this.currentSheet);
          break;
        }
      }
      if (!this.currentSheet) {
        console.warn(
          `Sheet "${sheetName}" not found in Workbook, using first sheet`
        );
      }
    }
  }

  /**
   */
  getActiveSheet() {
    return this.currentSheet!;
  }

  /**
   */
  getSheetByName(sheet: string) {
    for (const s of this.sheets) {
      if (s.getSheetName() === sheet) {
        return s;
      }
    }
    return null;
  }

  /**
   */
  getStyleSheet() {
    return this.styleSheet;
  }

  /**
   */
  getViewpointSize() {
    const {width, height} = this.contentContainer!.getBoundingClientRect();
    const currentSheet = this.currentSheet;
    const zoom = currentSheet!.getZoomLevel();
    return {
      width: width / zoom,
      height: height / zoom
    };
  }

  getDataProvider() {
    return this.dataProvider;
  }

  is1904() {
    return this.dataProvider.is1904();
  }

  getContainer() {
    return this.container;
  }

  getDataContainer() {
    return this.dataContainer!;
  }

  updateDataContainerSize(rowHeaderWidth: number, colHeaderHeight: number) {
    this.dataContainer!.style.left = `${rowHeaderWidth}px`;
    this.dataContainer!.style.top = `${colHeaderHeight}px`;
  }

  getWorkbookData() {
    return this.workbookData;
  }

  /**
   */
  renderInIframe(iframe: HTMLIFrameElement) {
    renderInIframe(iframe, this);
  }
}
