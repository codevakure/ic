/**
 */

import Excel from './Excel';
import {RenderOptions} from './RenderOptions';
import UnSupport from './UnSupport';
import Word from './Word';
import {parseContentType} from './openxml/ContentType';
import {PackageParser} from './package/PackageParser';
import ZipPackageParser from './package/ZipPackageParser';
import {fileTypeFromArrayBuffer, fileTypeFromBuffer} from './util/fileType';

/**
 */
export async function createOfficeViewer(
  docFile: ArrayBuffer,
  renderOptions?: Partial<RenderOptions>,
  fileName?: string,
  parser: PackageParser = new ZipPackageParser()
) {
  if (fileName) {
    const fileExt = fileName.split('.').pop();
    if (fileExt === 'csv' || fileExt === 'tsv') {
      const excel = new Excel(docFile, fileName, renderOptions, parser);
      await excel.loadCSV(fileExt);
      return excel;
    }
  }

  const fileType = fileTypeFromArrayBuffer(docFile);

  if (fileType === null || (fileType.ext !== 'zip' && fileType.ext !== 'xml')) {
    if (fileType?.ext === 'cfb') {
      return new UnSupport('Encrypted files not supported');
    }
    return new UnSupport('Unsupported file type: ' + fileType?.ext);
  }

  try {
    parser.load(docFile);
  } catch (error) {
    return new UnSupport('File parsing failed');
  }

  let isWord = false;
  let isExcel = false;
  // Some programs generate files without this, adding compatibility
  if (parser.fileExists('[Content_Types].xml')) {
    const contentTypes = parseContentType(parser.getXML('[Content_Types].xml'));

    for (const item of contentTypes.overrides) {
      if (item.contentType.indexOf('wordprocessingml') != -1) {
        isWord = true;
        break;
      } else if (item.contentType.indexOf('spreadsheetml') !== -1) {
        isExcel = true;
        break;
      }
    }
  } else {
    if (fileName?.endsWith('.xlsx')) {
      isExcel = true;
    } else if (fileName?.endsWith('.docx')) {
      isWord = true;
    }
  }

  // Currently only xml format is supported
  if (fileType?.ext === 'xml') {
    isWord = true;
  }

  if (isWord) {
    return new Word(docFile, renderOptions, parser);
  } else if (isExcel) {
    const excel = new Excel(docFile, fileName, renderOptions, parser);
    return excel;
  } else {
    throw new Error('not support file type');
  }
}
