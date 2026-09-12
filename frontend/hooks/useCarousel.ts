"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface UseCarouselResult {
  scrollRef: React.RefObject<HTMLDivElement | null>;
  scrollPrev: () => void;
  scrollNext: () => void;
  canScrollPrev: boolean;
  canScrollNext: boolean;
}

/**
 * Drives a native-scroll horizontal "deck" (no external carousel library):
 * tracks whether there's more content off-screen in either direction, and
 * exposes prev/next helpers that scroll by ~90% of the visible width.
 */
export function useCarousel(): UseCarouselResult {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(false);

  const updateScrollability = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const maxScrollLeft = el.scrollWidth - el.clientWidth;
    setCanScrollPrev(el.scrollLeft > 4);
    setCanScrollNext(el.scrollLeft < maxScrollLeft - 4);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    updateScrollability();

    const onScroll = () => updateScrollability();
    el.addEventListener("scroll", onScroll, { passive: true });

    const resizeObserver = new ResizeObserver(updateScrollability);
    resizeObserver.observe(el);

    return () => {
      el.removeEventListener("scroll", onScroll);
      resizeObserver.disconnect();
    };
  }, [updateScrollability]);

  const scrollByAmount = useCallback((direction: 1 | -1) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: direction * el.clientWidth * 0.9, behavior: "smooth" });
  }, []);

  return {
    scrollRef,
    scrollPrev: () => scrollByAmount(-1),
    scrollNext: () => scrollByAmount(1),
    canScrollPrev,
    canScrollNext,
  };
}
