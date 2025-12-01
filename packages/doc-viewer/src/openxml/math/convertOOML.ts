import {xsl} from './xsl';
/**
 */

export function convertOOXML(element: Element) {
  const xsltProcessor = new XSLTProcessor();
  xsltProcessor.importStylesheet(xsl);
  const fragment = xsltProcessor.transformToFragment(element, document);
  return fragment;
}
