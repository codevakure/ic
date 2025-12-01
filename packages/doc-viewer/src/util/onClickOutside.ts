/**
 */
export function onClickOutside(
  element: HTMLElement,
  onClickOutside: () => void
) {
  const outsideClickListener = (event: MouseEvent) => {
    if (event.target instanceof Node && !element.contains(event.target)) {
      onClickOutside();
    }
  };

  document.addEventListener('mousedown', outsideClickListener);

  return () => {
    document.removeEventListener('mousedown', outsideClickListener);
  };
}
