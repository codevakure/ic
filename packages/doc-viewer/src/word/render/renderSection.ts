import {WDocument} from '../../openxml/word/WDocument';
import {Section} from '../../openxml/word/Section';
import {createElement} from '../../util/dom';
import Word, {WordRenderOptions} from '../../Word';
import {fixAbsolutePosition} from './fixAbsolutePosition';
import {renderHeader} from './renderHeader';

/**
 */
export function renderSection(
  word: Word,
  wDocument: WDocument,
  section: Section,
  renderOptions: WordRenderOptions
) {
  const sectionEl = createElement('section') as HTMLElement;

  // [comment removed]
  sectionEl.style.position = 'relative';

  if (wDocument.backgroundColor) {
    sectionEl.style.background = wDocument.backgroundColor;
  }

  if (renderOptions.page) {
    if (renderOptions.pageMarginBottom) {
      sectionEl.style.marginBottom = renderOptions.pageMarginBottom + 'px';
    }

    if (renderOptions.pageShadow) {
      sectionEl.style.boxShadow = '0 0 8px rgba(0, 0, 0, 0.5)';
    }

    if (renderOptions.pageBackground) {
      sectionEl.style.background = renderOptions.pageBackground;
    }
  }

  const props = section.properties;
  const pageSize = props.pageSize;
  if (pageSize) {
    if (!renderOptions.ignoreWidth) {
      sectionEl.style.width = pageSize.width;
    }
    if (!renderOptions.ignoreHeight) {
      sectionEl.style.height = pageSize.height;
    }
  }

  // [comment removed]
  if (renderOptions.padding) {
    sectionEl.style.padding = renderOptions.padding;
  } else {
    const pageMargin = props.pageMargin;
    if (pageMargin) {
      sectionEl.style.paddingLeft = pageMargin.left || '0';
      sectionEl.style.paddingRight = pageMargin.right || '0';
      sectionEl.style.paddingTop = pageMargin.top || '0';
      sectionEl.style.paddingBottom = pageMargin.bottom || '0';
    }
  }

  if (props.cols) {
    if (props.cols.num && props.cols.num > 1) {
      sectionEl.style.columnCount = '' + props.cols.num;
      if (props.cols.space) {
        sectionEl.style.columnGap = props.cols.space;
      }
    }
  }

  word.currentPage++;

  let width = 'auto';
  if (props.pageSize && props.pageSize.width) {
    width = props.pageSize.width;
  }

  // [comment removed]
  if (props.headers && renderOptions.page && renderOptions.renderHeader) {
    const headers = props.headers;
    let headerEl = null;
    if (headers.even && word.currentPage % 2 === 0) {
      headerEl = renderHeader(word, headers.even);
    } else if (headers.default) {
      headerEl = renderHeader(word, headers.default);
    } else {
      console.warn('can not find header', word.currentPage, props.headers);
    }
    if (headerEl) {
      headerEl.style.position = 'absolute';
      const pageMargin = props.pageMargin;
      // [comment removed]
      if (pageMargin && pageMargin.header) {
        headerEl.style.top = pageMargin.header;
        headerEl.style.width = width;
      }

      sectionEl.appendChild(headerEl);
    }
  }

  if (props.footers && renderOptions.page && renderOptions.renderFooter) {
    const footers = props.footers;
    let footerEl = null;

    if (footers.even && word.currentPage % 2 === 0) {
      footerEl = renderHeader(word, footers.even);
    } else if (footers.default) {
      footerEl = renderHeader(word, footers.default);
    } else {
      console.warn('can not find footer', word.currentPage, props.footers);
    }
    if (footerEl) {
      footerEl.style.position = 'absolute';
      const pageMargin = props.pageMargin;
      if (pageMargin && pageMargin.footer) {
        footerEl.style.bottom = pageMargin.footer;
        footerEl.style.width = width;
      }
      sectionEl.appendChild(footerEl);
    }
  }

  return sectionEl;
}
