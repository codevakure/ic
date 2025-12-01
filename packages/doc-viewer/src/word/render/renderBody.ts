/**
 */

import {createElement, appendChild, removeChild} from '../../util/dom';
import Word, {WordRenderOptions} from '../../Word';
import {Body} from '../../openxml/word/Body';
import {Paragraph} from '../../openxml/word/Paragraph';
import {Table} from '../../openxml/word/Table';
import renderParagraph from './renderParagraph';
import {renderSection} from './renderSection';
import renderTable from './renderTable';
import {Section} from '../../openxml/word/Section';
import {WDocument} from '../../openxml/word/WDocument';

/**
 */
function createNewSection(
  word: Word,
  sectionEnd: SectionEnd,
  child: HTMLElement
) {
  // [comment removed]
  if (word.breakPage) {
    word.breakPage = false;
    return true;
  }
  const childBound = child.getBoundingClientRect();
  return (
    childBound.top + childBound.height > sectionEnd.bottom ||
    // [comment removed]
    childBound.left > sectionEnd.right
  );
}

/**
 */
function appendToSection(
  word: Word,
  wDocument: WDocument,
  renderOptions: WordRenderOptions,
  bodyEl: HTMLElement,
  sectionEl: HTMLElement,
  sectionEnd: SectionEnd,
  section: Section,
  child: HTMLElement
) {
  // [comment removed]
  const isFirst = sectionEl.children.length === 0;
  // [comment removed]
  appendChild(sectionEl, child);

  // [comment removed]
  if (!isFirst && createNewSection(word, sectionEnd, child)) {
    const newChild = child.cloneNode(true) as HTMLElement;
    removeChild(sectionEl, child);
    let newSectionEl = renderSection(word, wDocument, section, renderOptions);
    appendChild(bodyEl, newSectionEl);
    appendChild(newSectionEl, newChild);
    sectionEnd = getSectionEnd(section, newSectionEl);
    return {sectionEl: newSectionEl, sectionEnd};
  }

  return {sectionEl, sectionEnd};
}

type SectionEnd = {
  bottom: number;
  right: number;
};

/**
 */
function getSectionEnd(section: Section, sectionEl: HTMLElement): SectionEnd {
  const sectionBound = sectionEl.getBoundingClientRect();
  const pageMargin = section.properties.pageMargin;
  let bottom = sectionBound.top + sectionBound.height;
  if (pageMargin?.bottom) {
    bottom = bottom - parseInt(pageMargin.bottom.replace('px', ''), 10);
  }
  let right = sectionBound.left + sectionBound.width;
  if (pageMargin?.right) {
    right = right - parseInt(pageMargin.right.replace('px', ''), 10);
  }
  return {bottom, right};
}

/**
 */
function getTransform(
  rootWidth: number,
  section: Section,
  renderOptions: WordRenderOptions
) {
  const props = section.properties;
  const pageSize = props.pageSize;
  if (renderOptions.zoomFitWidth && !renderOptions.ignoreWidth) {
    const pageWidth = pageSize?.width;
    if (rootWidth && pageWidth) {
      let pageWidthNum = parseInt(pageWidth.replace('px', ''), 10);

      if (props.pageMargin) {
        const pageMargin = props.pageMargin;
        pageWidthNum += pageMargin.left
          ? parseInt(pageMargin.left.replace('px', ''), 10)
          : 0;
        pageWidthNum += pageMargin.right
          ? parseInt(pageMargin.right.replace('px', ''), 10)
          : 0;
      }
      const zoomWidth = rootWidth / pageWidthNum;

      return zoomWidth;
    }
  }
  return 1;
}

/**
 */
function renderSectionInPage(
  word: Word,
  wDocument: WDocument,
  bodyEl: HTMLElement,
  renderOptions: WordRenderOptions,
  sectionEl: HTMLElement,
  section: Section,
  isLastSection: boolean
) {
  // [comment removed]
  setTimeout(() => {
    let sectionEnd = getSectionEnd(section, sectionEl);
    for (const child of section.children) {
      if (child instanceof Paragraph) {
        const p = renderParagraph(word, child);
        const appendResult = appendToSection(
          word,
          wDocument,
          renderOptions,
          bodyEl,
          sectionEl,
          sectionEnd,
          section,
          p
        );
        sectionEl = appendResult.sectionEl;
        sectionEnd = appendResult.sectionEnd;
      } else if (child instanceof Table) {
        const table = renderTable(word, child);
        const appendResult = appendToSection(
          word,
          wDocument,
          renderOptions,
          bodyEl,
          sectionEl,
          sectionEnd,
          section,
          table
        );
        sectionEl = appendResult.sectionEl;
        sectionEnd = appendResult.sectionEnd;
      } else {
        console.warn('unknown child', child);
      }
    }

    if (isLastSection) {
      sectionEl.style.marginBottom = '0';
    }
  }, 0);
}

/**
 */
export default function renderBody(
  root: HTMLElement,
  word: Word,
  bodyEl: HTMLElement,
  wDocument: WDocument,
  body: Body,
  renderOptions: WordRenderOptions
) {
  const page = renderOptions.page || false;

  const rootWidth =
    root.getBoundingClientRect().width -
    (renderOptions.pageWrapPadding || 0) * 2;

  const zooms: number[] = [];

  let index = 0;
  const sections = body.sections;
  const sectionLength = sections.length;
  // [comment removed]
  let isLastSection = false;
  for (const section of sections) {
    zooms.push(getTransform(rootWidth, section, renderOptions));
    word.currentSection = section;
    let sectionEl = renderSection(word, wDocument, section, renderOptions);
    appendChild(bodyEl, sectionEl);

    index = index + 1;
    if (index === sectionLength) {
      isLastSection = true;
    }
    if (page) {
      renderSectionInPage(
        word,
        wDocument,
        bodyEl,
        renderOptions,
        sectionEl,
        section,
        isLastSection
      );
    } else {
      for (const child of section.children) {
        if (child instanceof Paragraph) {
          const p = renderParagraph(word, child);
          appendChild(sectionEl, p);
        } else if (child instanceof Table) {
          const table = renderTable(word, child);
          appendChild(sectionEl, table);
        } else {
          console.warn('unknown child', child);
        }
      }
    }
  }

  setTimeout(() => {
    if (renderOptions.zoom) {
      // [comment removed]
      bodyEl.style.transformOrigin = '0 0';
      bodyEl.style.transform = `scale(${renderOptions.zoom})`;
    } else if (
      renderOptions.page &&
      renderOptions.zoomFitWidth &&
      !renderOptions.ignoreWidth
    ) {
      // [comment removed]
      const minZoom = Math.min(...zooms);
      bodyEl.style.transformOrigin = '0 0';
      bodyEl.style.transform = `scale(${minZoom})`;
    }
  }, 0);
}
