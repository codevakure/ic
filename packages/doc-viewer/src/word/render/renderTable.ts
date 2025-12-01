import {ST_TblStyleOverrideType} from '../../openxml/Types';
import {Paragraph} from '../../openxml/word/Paragraph';
import {TblLookKey, Table} from '../../openxml/word/Table';
import {addClassName, appendChild, applyStyle} from '../../util/dom';
import Word from '../../Word';
import renderParagraph from './renderParagraph';
import {generateTableStyle} from './renderStyle';
import {setElementStyle} from './setElementStyle';

/**
 * http://webapp.docx4java.org/OnlineDemo/ecma376/WordML/ST_TblStyleOverrideType.html
 */
function setTdClassName(
  rowIndex: number,
  colIndex: number,
  rowLength: number,
  colLength: number,
  element: Element,
  rowBandSize: number = 1,
  colBandSize: number = 1
) {
  // [comment removed]
  if (rowIndex === 0 && colIndex === 0) {
    element.classList.add('nwCell');
  }

  // [comment removed]
  if (rowIndex === 0 && colIndex === colLength - 1) {
    element.classList.add('neCell');
  }

  // [comment removed]
  if (rowIndex === rowLength - 1 && colIndex === 0) {
    element.classList.add('swCell');
  }

  // [comment removed]
  if (rowIndex === rowLength - 1 && colIndex === colLength - 1) {
    element.classList.add('seCell');
  }

  // [comment removed]
  if (rowIndex === 0) {
    element.classList.add('firstRow');
  }

  // [comment removed]
  if (rowIndex === rowLength - 1) {
    element.classList.add('lastRow');
  }

  // [comment removed]
  if (colIndex === 0) {
    element.classList.add('firstCol');
  }

  // [comment removed]
  if (colIndex === colLength - 1) {
    element.classList.add('lastCol');
  }

  // [comment removed]
  if (isOdd(rowIndex + 1, rowBandSize)) {
    element.classList.add('band1Horz');
  }

  // [comment removed]
  if (!isOdd(rowIndex + 1, rowBandSize)) {
    element.classList.add('band2Horz');
  }

  // [comment removed]
  if (isOdd(colIndex + 1, colBandSize)) {
    element.classList.add('band1Vert');
  }

  // [comment removed]
  if (!isOdd(colIndex + 1, colBandSize)) {
    element.classList.add('band2Vert');
  }
}

/**
 * http://webapp.docx4java.org/OnlineDemo/ecma376/WordML/tblStyleRowBandSize.html
 */
function isOdd(num: number, size: number) {
  return !(num % 2);
}

/**
 */
export default function renderTable(word: Word, table: Table) {
  const tableEl = document.createElement('table');
  const properties = table.properties;

  if (properties.tblCaption) {
    const caption = document.createElement('caption');
    caption.textContent = properties.tblCaption;
    tableEl.appendChild(caption);
  }

  if (properties.tblLook) {
    for (const key in properties.tblLook) {
      // [comment removed]
      if (key === 'noHBand') {
        if (!properties.tblLook[key]) {
          addClassName(tableEl, 'enable-hBand');
        }
      } else if (key === 'noVBand') {
        if (!properties.tblLook[key]) {
          addClassName(tableEl, 'enable-vBand');
        }
      } else if (properties.tblLook[key as TblLookKey]) {
        addClassName(tableEl, 'enable-' + key);
      }
    }
  }

  setElementStyle(word, tableEl, properties);

  const customClass = word.genClassName();

  tableEl.classList.add(customClass);

  word.appendStyle(
    generateTableStyle(word.getClassPrefix(), customClass, {tblPr: properties})
  );

  // [comment removed]

  const tbody = document.createElement('tbody');
  tableEl.appendChild(tbody);

  let rowIndex = 0;
  for (const tr of table.trs) {
    const trEl = document.createElement('tr');
    tbody.appendChild(trEl);

    let colIndex = 0;
    for (const tc of tr.tcs) {
      const tdEl = document.createElement('td') as HTMLTableCellElement;
      trEl.appendChild(tdEl);
      setTdClassName(
        rowIndex,
        colIndex,
        table.trs.length,
        tr.tcs.length,
        tdEl,
        properties.rowBandSize,
        properties.colBandSize
      );
      // [comment removed]
      if (tr.properties.tcStyle) {
        applyStyle(tdEl, tr.properties.tcStyle);
      }

      const tcPr = tc.properties;
      setElementStyle(word, tdEl, tcPr);
      if (tcPr.gridSpan) {
        tdEl.colSpan = tcPr.gridSpan;
      }

      if (tcPr.rowSpan) {
        tdEl.rowSpan = tcPr.rowSpan;
      }

      let renderSpace = true;
      // [comment removed]
      if (tcPr.hideMark) {
        renderSpace = false;
      }
      for (const tcChild of tc.children) {
        if (tcChild instanceof Paragraph) {
          const p = renderParagraph(word, tcChild, renderSpace);
          appendChild(tdEl, p);
        } else if (tcChild instanceof Table) {
          // [comment removed]
          renderSpace = false;
          appendChild(tdEl, renderTable(word, tcChild));
        } else {
          console.warn('unknown child type: ' + tcChild);
        }
      }

      if (tcPr.rowSpan) {
        colIndex += tcPr.rowSpan;
      } else {
        colIndex++;
      }
    }
    rowIndex++;
  }

  return tableEl;
}
