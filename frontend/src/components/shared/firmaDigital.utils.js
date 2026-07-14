export function getCanvasPoint(sourceEvent, canvas) {
  const rect = canvas.getBoundingClientRect();
  const pointSource = sourceEvent?.touches?.[0] ?? sourceEvent?.changedTouches?.[0] ?? sourceEvent;

  return {
    x: pointSource.clientX - rect.left,
    y: pointSource.clientY - rect.top
  };
}

export function getDrawingPoints(event) {
  const nativeEvent = event?.nativeEvent ?? event;

  if (typeof nativeEvent?.getCoalescedEvents === "function") {
    const coalescedEvents = nativeEvent.getCoalescedEvents();
    if (Array.isArray(coalescedEvents) && coalescedEvents.length > 0) {
      return coalescedEvents;
    }
  }

  if (nativeEvent?.touches?.length) {
    return [nativeEvent.touches[0]];
  }

  if (nativeEvent?.changedTouches?.length) {
    return [nativeEvent.changedTouches[0]];
  }

  return [nativeEvent];
}
