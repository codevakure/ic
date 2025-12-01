/**
 */

export function onClickOutsideOnce(
  element: HTMLElement,
  onClickOutside: () => void
) {
  const outsideClickListener = (event: MouseEvent) => {
    if (event.target instanceof Node && !element.contains(event.target)) {
      onClickOutside();
      document.removeEventListener('mousedown', outsideClickListener);
    }
  };

  document.addEventListener('mousedown', outsideClickListener);
}
