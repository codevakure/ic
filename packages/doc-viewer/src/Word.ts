import {FontTable} from './openxml/word/FontTable';
/**
 */

import {parseRelationships, Relationship} from './word/parse/parseRelationship';
import {ContentTypes, parseContentType} from './openxml/ContentType';
import {parseStyles, Styles} from './openxml/Style';
import {parseTheme, Theme} from './openxml/Theme';

import renderDocument from './word/render/renderDocument';
import {blobToDataURL, downloadBlob} from './util/blob';
import {Numbering} from './openxml/word/numbering/Numbering';
import {appendChild, createElement} from './util/dom';
import {renderStyle} from './word/render/renderStyle';
import {mergeRun} from './util/mergeRun';
import {WDocument} from './openxml/word/WDocument';
import {PackageParser} from './package/PackageParser';
import {updateVariableText} from './word/render/renderRun';
import ZipPackageParser from './package/ZipPackageParser';
import {buildXML} from './util/xml';
import {Paragraph} from './openxml/word/Paragraph';
import {deobfuscate} from './openxml/word/Font';
import {renderFont} from './word/render/renderFont';
import {replaceT, replaceVar} from './util/replaceVar';
import {Note} from './openxml/word/Note';
import {parseFootnotes} from './word/parse/Footnotes';
import {parseEndnotes} from './word/parse/parseEndnotes';
import {renderNotes} from './word/render/renderNotes';
import {Section} from './openxml/word/Section';
import {printIframe} from './util/print';
import {Settings} from './openxml/Settings';
import {get} from './util/get';
import {fileTypeFromBuffer} from './util/fileType';
import {OfficeViewer} from './OfficeViewer';
import {RenderOptions} from './RenderOptions';
import {parse} from 'zrender/lib/tool/color';
import {stylesXML} from './word/parse/defaultXML/stylesXML';
import {themeXML} from './word/parse/defaultXML/themeXML';
import {settingsXML} from './word/parse/defaultXML/settingsXML';

/**
 */
export interface WordRenderOptions extends RenderOptions {
  /**
   */
  classPrefix: string;

  /**
   */
  bulletUseFont: boolean;

  /**
   */
  ignoreWidth?: boolean;

  /**
   */
  ignoreHeight?: boolean;

  /**
   */
  padding?: string;

  /**
   */
  minLineHeight?: number;

  /**
   */
  forceLineHeight?: string;

  /**
   */
  printWaitTime?: number;

  /**
   */
  page?: boolean;

  /**
   */
  pageMarginBottom?: number;

  /**
   */
  pageBackground?: string;

  /**
   */
  pageShadow?: boolean;

  /**
   */
  pageWrap?: boolean;

  /**
   */
  pageWrapPadding?: number;

  /**
   */
  pageWrapBackground?: string;

  /**
   */
  zoom?: number;

  /**
   */
  zoomFitWidth?: boolean;

  /**
   */
  printOptions?: WordRenderOptions;

  /**
   */
  renderHeader?: boolean;

  /**
   */
  renderFooter?: boolean;
}

const defaultRenderOptions: WordRenderOptions = {
  classPrefix: 'docx-viewer',
  page: false,
  pageWrap: true,
  bulletUseFont: true,
  ignoreHeight: true,
  ignoreWidth: false,
  minLineHeight: 1.0,
  enableVar: false,
  debug: false,
  pageWrapPadding: 20,
  pageMarginBottom: 20,
  pageShadow: true,
  pageBackground: '#FFFFFF',
  pageWrapBackground: '#ECECEC',
  printWaitTime: 100,
  zoomFitWidth: false,
  renderHeader: true,
  renderFooter: true,
  data: {},
  evalVar: (path: string, data: any) => {
    return get(data, path);
  }
};

export default class Word implements OfficeViewer {
  /**
   */
  static globalId = 0;

  /**
   */
  id: number;

  /**
   */
  parser: PackageParser;

  /**
   */
  contentTypes: ContentTypes;

  /**
   */
  themes: Theme[] = [];

  /**
   */
  numbering: Numbering;

  settings: Settings;

  /**
   */
  styles: Styles;

  renderOptions: WordRenderOptions;

  /**
   */
  relationships: Record<string, Relationship>;

  /**
   */
  documentRels: Record<string, Relationship>;

  /**
   */
  currentDocumentRels: Record<string, Relationship>;

  /**
   */
  fontTableRels: Record<string, Relationship>;

  /**
   */
  styleIdMap: Record<string, string> = {};

  /**
   */
  styleIdNum: number = 0;

  /**
   */
  fontTable?: FontTable;

  /**
   */
  rootElement: HTMLElement;

  wrapClassName = 'docx-viewer-wrapper';

  /**
   */
  currentParagraph: Paragraph;

  footNotes: Record<string, Note> = {};

  endNotes: Record<string, Note> = {};

  /**
   */
  currentPage: 0;

  /**
   *
   */
  constructor(
    docFile: ArrayBuffer | string,
    renderOptions?: Partial<WordRenderOptions>,
    parser: PackageParser = new ZipPackageParser()
  ) {
    parser.load(docFile);
    this.id = Word.globalId++;
    this.parser = parser;
    this.updateOptions(renderOptions);
  }

  inited = false;

  /**
   */
  breakPage = false;

  /**
   */
  currentSection: Section;

  DOCUMENT_RELS = '/word/_rels/document.xml.rels';

  /**
   */
  init() {
    if (this.inited) {
      return;
    }

    // [comment removed]
    this.initContentType();
    // [comment removed]
    this.initRelation();

    this.initSettings();

    this.initTheme();
    this.initFontTable();
    this.initStyle();
    this.initNumbering();

    this.initNotes();

    this.inited = true;
  }

  updateOptions(options: any) {
    this.renderOptions = {...defaultRenderOptions, ...options};
    if (this.renderOptions.page) {
      this.renderOptions.ignoreHeight = false;
      this.renderOptions.ignoreWidth = false;
    }
  }

  /**
   */
  initTheme() {
    for (const override of this.contentTypes.overrides) {
      if (override.partName.startsWith('/word/theme')) {
        const theme = this.parser.getXML(override.partName);
        this.themes.push(parseTheme(theme));
      }
    }
    if (this.themes.length === 0) {
      this.themes.push(parseTheme(themeXML));
    }
  }

  /**
   */
  initStyle() {
    for (const override of this.contentTypes.overrides) {
      if (override.partName.startsWith('/word/styles.xml')) {
        this.styles = parseStyles(this, this.parser.getXML('/word/styles.xml'));
      }
    }
    // [comment removed]
    if (!this.styles) {
      this.styles = parseStyles(this, stylesXML);
    }
  }

  /**
   */
  initSettings() {
    for (const override of this.contentTypes.overrides) {
      if (override.partName.startsWith('/word/settings.xml')) {
        this.settings = Settings.parse(
          this,
          this.parser.getXML('/word/settings.xml')
        );
      }
    }
    if (!this.settings) {
      this.settings = Settings.parse(this, settingsXML);
    }
  }

  /**
   */
  initFontTable() {
    for (const override of this.contentTypes.overrides) {
      if (override.partName.startsWith('/word/fontTable.xml')) {
        this.fontTable = FontTable.fromXML(
          this,
          this.parser.getXML('/word/fontTable.xml')
        );
      }
    }
  }

  /**
   */
  initRelation() {
    let rels = {};
    if (this.parser.fileExists('/_rels/.rels')) {
      rels = parseRelationships(this.parser.getXML('/_rels/.rels'), 'root');
    }

    this.relationships = rels;

    let documentRels = {};
    if (this.parser.fileExists(this.DOCUMENT_RELS)) {
      documentRels = parseRelationships(
        this.parser.getXML(this.DOCUMENT_RELS),
        'word'
      );
    }
    this.documentRels = documentRels;

    let fontTableRels = {};
    if (this.parser.fileExists('/word/_rels/fontTable.xml.rels')) {
      fontTableRels = parseRelationships(
        this.parser.getXML('/word/_rels/fontTable.xml.rels'),
        'word'
      );
    }
    this.fontTableRels = fontTableRels;
  }

  /**
   */
  initContentType() {
    const contentType = this.parser.getXML('[Content_Types].xml');
    this.contentTypes = parseContentType(contentType);
  }

  /**
   */
  initNumbering() {
    for (const override of this.contentTypes.overrides) {
      if (override.partName.startsWith('/word/numbering')) {
        const numberingData = this.parser.getXML(override.partName);
        this.numbering = Numbering.fromXML(this, numberingData);
      }
    }
  }

  initNotes() {
    for (const override of this.contentTypes.overrides) {
      if (override.partName.startsWith('/word/footnotes.xml')) {
        const notesData = this.parser.getXML(override.partName);
        this.footNotes = parseFootnotes(this, notesData);
      }
      if (override.partName.startsWith('/word/endnotes.xml')) {
        const notesData = this.parser.getXML(override.partName);
        this.endNotes = parseEndnotes(this, notesData);
      }
    }
  }

  /**
   */
  getRelationship(id?: string) {
    if (id && this.relationships) {
      return this.relationships[id];
    }
    return null;
  }

  /**
   */
  getDocumentRels(id?: string) {
    if (id && this.documentRels) {
      return this.documentRels[id];
    }
    return null;
  }

  /**
   */
  getFontTableRels(id?: string) {
    if (id && this.fontTableRels) {
      return this.fontTableRels[id];
    }
    return null;
  }

  /**
   */
  replaceText(text: string) {
    if (this.renderOptions.enableVar === false) {
      return text;
    }
    const data = this.renderOptions.data;
    if (text.indexOf('{{') !== -1) {
      text = text.replace(/{{([^{}]+)}}/g, (all: string, group: string) => {
        const result = this.renderOptions.evalVar(group, data);
        if (typeof result === 'undefined') {
          return '';
        }
        return String(result);
      });
    }
    return text;
  }

  loadWordRelXML(relation: Relationship): Document {
    let path = relation.target;
    if (relation.part === 'word') {
      path = 'word/' + path;
    }
    return this.getXML(path);
  }

  /**
   */
  loadImage(relation: Relationship): string | null {
    let path = relation.target;
    if (relation.part === 'word') {
      path = 'word/' + path;
    }

    const data = this.parser.getFileByType(path, 'blob');
    if (data) {
      return URL.createObjectURL(data as Blob);
    }

    return null;
  }

  /**
   */
  saveNewImage(newRelId: string, data: Uint8Array) {
    if (this.parser.fileExists(this.DOCUMENT_RELS)) {
      const documentRels = this.parser.getXML(this.DOCUMENT_RELS);
      // [comment removed]
      const newRelation = documentRels
        .getElementsByTagName('Relationship')
        .item(0)!
        .cloneNode(true) as Element;
      newRelation.setAttributeNS(null, 'Id', newRelId);
      newRelation.setAttributeNS(
        null,
        'Type',
        'http://schemas.openxmlformats.org/officeDocument/2006/relationships/image'
      );
      let ext = '';
      const fileType = fileTypeFromBuffer(data);
      if (fileType) {
        ext = '.' + fileType.ext;
      }

      const imagePath = 'media/image' + newRelId + ext;
      newRelation.setAttributeNS(null, 'Target', imagePath);
      documentRels
        .getElementsByTagName('Relationships')[0]
        .appendChild(newRelation);

      // [comment removed]
      this.parser.saveFile(
        this.DOCUMENT_RELS.replace(/^\//, ''),
        buildXML(documentRels)
      );

      this.parser.saveFile('word/' + imagePath, data);
    }
  }

  loadFont(rId: string, key: string) {
    const relation = this.getFontTableRels(rId);
    if (!relation) {
      return null;
    }

    let path = relation.target;
    if (relation.part === 'word') {
      path = 'word/' + path;
    }

    const data = this.parser.getFileByType(path, 'uint8array') as Uint8Array;
    if (data) {
      return URL.createObjectURL(new Blob([deobfuscate(data, key) as any]));
    }

    return null;
  }

  /**
   */
  getXML(filePath: string): Document {
    return this.parser.getXML(filePath);
  }

  /**
   */
  getStyleIdDisplayName(styleId: string) {
    /**
     * In CSS, identifiers (including element names, classes, and IDs in selectors) can contain only the characters [a-zA-Z0-9] and ISO 10646 characters U+00A0 and higher, plus the hyphen (-) and the underscore (_); they cannot start with a digit, two hyphens, or a hyphen followed by a digit. Identifiers can also contain escaped characters and any ISO 10646 character as a numeric code (see next item). For instance, the identifier "B&W?" may be written as "B\&W\?" or "B\26 W\3F".
     */
    if (/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(styleId)) {
      return this.getClassPrefix() + '-' + styleId;
    }
    if (styleId in this.styleIdMap) {
      return this.styleIdMap[styleId];
    } else {
      this.styleIdMap[styleId] = this.genClassName();
      return this.styleIdMap[styleId];
    }
  }

  /**
   */
  genClassName() {
    return 'docx-classname-' + this.styleIdNum++;
  }

  /**
   */
  appendStyle(style: string = '') {
    const styleElement = createElement('style');
    styleElement.textContent = style;
    this.rootElement.appendChild(styleElement);
  }

  /**
   */
  getStyleClassName(stylId: string) {
    const style = this.styles.styleMap[stylId];

    if (!style) {
      return [];
    }

    const classNames = [this.getStyleIdDisplayName(stylId)];
    if (style.basedOn) {
      classNames.unshift(this.getStyleIdDisplayName(style.basedOn));
    }
    return classNames;
  }

  /**
   * @param styleId
   */
  getStyle(styleId: string) {
    return this.styles.styleMap[styleId];
  }

  /**
   */
  getClassPrefix() {
    return `${this.renderOptions.classPrefix}-${this.id}`;
  }

  /**
   */
  getThemeColor(name: string) {
    if (this.settings.clrSchemeMapping) {
      name = this.settings.clrSchemeMapping[name] || name;
    }

    if (this.themes && this.themes.length > 0) {
      const theme = this.themes[0];
      const colors = theme.themeElements?.clrScheme?.colors;
      const color = colors?.[name];
      if (color) {
        return color;
      } else {
        // [comment removed]
        console.warn('unknown theme color: ' + name);
        return colors?.['accent1'] || '';
      }
    }

    return '';
  }

  /**
   */
  addClass(element: HTMLElement, className: string) {
    element.classList.add(`${this.getClassPrefix()}-${className}`);
  }

  /**
   */
  updateVariable() {
    if (!this.rootElement || this.renderOptions.enableVar === false) {
      return;
    }
    updateVariableText(this);
  }

  /**
   */
  async download(fileName: string = 'document.docx') {
    const documentData = this.getXML('word/document.xml');

    if (this.renderOptions.enableVar) {
      mergeRun(this, documentData);
      await replaceVar(this, documentData, true);
      // [comment removed]
      const ts = documentData.getElementsByTagName('w:t');
      for (let i = 0; i < ts.length; i++) {
        replaceT(this, ts[i], this.renderOptions.data);
      }
    }

    const blob = this.parser.generateZipBlob(buildXML(documentData));
    downloadBlob(blob, fileName);
  }

  /**
   */
  async print(): Promise<any> {
    const iframe = document.createElement('iframe') as HTMLIFrameElement;
    iframe.style.position = 'absolute';
    iframe.style.top = '-10000px';
    document.body.appendChild(iframe);
    const printDocument = iframe.contentDocument;
    if (!printDocument) {
      console.warn('printDocument is null');
      return null;
    }
    printDocument.write(
      `<style>
      html, body { margin:0; padding:0 }
      @page { size: auto; margin: 0mm; }
      </style>
      <div id="print"></div>`
    );
    await this.render(
      printDocument.getElementById('print') as HTMLElement,
      // [comment removed]
      {
        pageWrap: false,
        pageShadow: false,
        pageMarginBottom: 0,
        pageWrapPadding: undefined,
        zoom: 1,
        ...this.renderOptions.printOptions
      }
    );
    setTimeout(function () {
      iframe.focus();
      printIframe(iframe);
    }, this.renderOptions.printWaitTime || 100); // [comment removed]
    window.focus();
  }

  /**
   *
   */
  async render(
    root: HTMLElement,
    renderOptionsOverride: Partial<WordRenderOptions> = {}
  ) {
    this.init();
    this.currentPage = 0;
    const renderOptions = {...this.renderOptions, ...renderOptionsOverride};

    const isDebug = renderOptions.debug;
    isDebug && console.log('init', this);
    this.rootElement = root;
    root.innerHTML = '';
    const documentData = this.getXML('word/document.xml');

    isDebug && console.log('documentData', documentData);

    if (renderOptions.enableVar) {
      mergeRun(this, documentData);
      await replaceVar(this, documentData);
      // [comment removed]
    }

    const document = WDocument.fromXML(this, documentData);

    isDebug && console.log('document', document);

    const documentElement = renderDocument(root, this, document, renderOptions);
    root.classList.add(this.getClassPrefix());
    if (renderOptions.page && renderOptions.pageWrap) {
      root.classList.add(this.wrapClassName);
      root.style.padding = `${renderOptions.pageWrapPadding || 0}pt`;
      root.style.background = renderOptions.pageWrapBackground || '#ECECEC';
    }

    appendChild(root, renderStyle(this));
    appendChild(root, renderFont(this.fontTable));
    appendChild(root, documentElement);

    appendChild(root, renderNotes(this));
  }

  destroy(): void {}
}
