"use client";

import { useEffect, type RefObject } from "react";

/**
 * Invokes `handler` when a pointer event lands outside every element in `refs`.
 * Accepts multiple refs so a trigger button (e.g. a dropdown's chevron) can be
 * excluded from "outside" without a second layer of state.
 */
export const useClickOutside = (
  refs: RefObject<HTMLElement | null> | RefObject<HTMLElement | null>[],
  handler: (event: MouseEvent | TouchEvent) => void,
  active = true,
): void => {
  useEffect(() => {
    if (!active) return;

    const refList = Array.isArray(refs) ? refs : [refs];

    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node;
      const isInside = refList.some((ref) => ref.current?.contains(target));
      if (!isInside) handler(event);
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
    };
  }, [refs, handler, active]);
};
