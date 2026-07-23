import {
  useRef,
  type Dispatch,
  type PointerEvent as ReactPointerEvent,
  type SetStateAction,
} from "react";

export function usePinchPanZoom(
  zoom: number,
  setZoom: Dispatch<SetStateAction<number>>,
  minZoom: number,
  maxZoom: number,
) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const touchPoints = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{
    distance: number;
    zoom: number;
    contentX: number;
    contentY: number;
  } | null>(null);
  const pan = useRef<{
    x: number;
    y: number;
    scrollLeft: number;
    scrollTop: number;
  } | null>(null);

  const clampZoom = (value: number) => Math.min(maxZoom, Math.max(minZoom, value));
  const getTouchPair = () => {
    const points = [...touchPoints.current.values()];
    if (points.length !== 2) return null;
    const [first, second] = points;
    return {
      distance: Math.hypot(second.x - first.x, second.y - first.y),
      x: (first.x + second.x) / 2,
      y: (first.y + second.y) / 2,
    };
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== "touch") return;
    event.currentTarget.setPointerCapture(event.pointerId);
    touchPoints.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const scroller = scrollRef.current;
    if (!scroller) return;

    if (touchPoints.current.size === 1) {
      pan.current = {
        x: event.clientX,
        y: event.clientY,
        scrollLeft: scroller.scrollLeft,
        scrollTop: scroller.scrollTop,
      };
    } else if (touchPoints.current.size === 2) {
      const pair = getTouchPair();
      if (!pair) return;
      const bounds = scroller.getBoundingClientRect();
      pinch.current = {
        distance: pair.distance,
        zoom,
        contentX: (scroller.scrollLeft + pair.x - bounds.left) / zoom,
        contentY: (scroller.scrollTop + pair.y - bounds.top) / zoom,
      };
      pan.current = null;
    }
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== "touch" || !touchPoints.current.has(event.pointerId)) {
      return;
    }
    touchPoints.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const scroller = scrollRef.current;
    if (!scroller) return;

    if (touchPoints.current.size === 2 && pinch.current) {
      const pair = getTouchPair();
      if (!pair || pinch.current.distance === 0) return;
      event.preventDefault();
      const nextZoom = clampZoom(
        pinch.current.zoom * (pair.distance / pinch.current.distance),
      );
      const { contentX, contentY } = pinch.current;
      const bounds = scroller.getBoundingClientRect();
      setZoom(nextZoom);
      requestAnimationFrame(() => {
        scroller.scrollLeft = contentX * nextZoom - (pair.x - bounds.left);
        scroller.scrollTop = contentY * nextZoom - (pair.y - bounds.top);
      });
    } else if (touchPoints.current.size === 1 && pan.current) {
      event.preventDefault();
      scroller.scrollLeft = pan.current.scrollLeft - (event.clientX - pan.current.x);
      scroller.scrollTop = pan.current.scrollTop - (event.clientY - pan.current.y);
    }
  };

  const onPointerEnd = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== "touch") return;
    touchPoints.current.delete(event.pointerId);
    pinch.current = null;
    const scroller = scrollRef.current;
    const remaining = [...touchPoints.current.values()][0];
    if (scroller && remaining) {
      pan.current = {
        x: remaining.x,
        y: remaining.y,
        scrollLeft: scroller.scrollLeft,
        scrollTop: scroller.scrollTop,
      };
    } else {
      pan.current = null;
    }
  };

  return {
    scrollRef,
    clampZoom,
    pointerHandlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: onPointerEnd,
      onPointerCancel: onPointerEnd,
    },
  };
}
