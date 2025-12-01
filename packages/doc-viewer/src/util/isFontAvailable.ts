/**
 */

const testString = Array(15).join('abcdefghijklmnopqrstuvwxyz0123456789W');

export const isFontAvailable = (function () {
  // [comment removed]
  if (!document) {
    return () => true;
  }
  const body = document.body;

  const container = document.createElement('span');
  container.innerHTML = testString;
  container.style.cssText = [
    'position:absolute',
    'width:auto',
    'font-size:128px',
    'left:-99999px'
  ].join(' !important;');

  const getWidth = function (fontFamily: string) {
    container.style.fontFamily = fontFamily;

    body.appendChild(container);
    const width = container.clientWidth;
    body.removeChild(container);

    return width;
  };

  const monoWidth = getWidth('monospace');
  const serifWidth = getWidth('serif');
  const sansWidth = getWidth('sans-serif');

  return (font: string) => {
    return (
      monoWidth !== getWidth(font + ',monospace') ||
      sansWidth !== getWidth(font + ',sans-serif') ||
      serifWidth !== getWidth(font + ',serif')
    );
  };
})();
