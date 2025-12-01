/**
 */
export function getMouseRelativePosition(
  container: HTMLElement,
  event: MouseEvent
) {
  const dataContainerOffset = container.getBoundingClientRect();
  const offsetX = event.clientX - dataContainerOffset.x;
  const offsetY = event.clientY - dataContainerOffset.y;
  return {offsetX, offsetY};
}
