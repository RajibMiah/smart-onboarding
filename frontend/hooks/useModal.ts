"use client";

import { useEffect } from "react";

import { useUI } from "@/context/ui-context";

interface UseModalResult {
  isOpen: boolean;
  open: () => void;
  close: () => void;
}

/**
 * Binds one named modal to the app-wide modal manager in `UIContext`
 * (only one modal id can be active at a time), and layers on the standard
 * modal side effects: Escape-to-close and background-scroll lock.
 */
export const useModal = (id: string): UseModalResult => {
  const { activeModal, openModal, closeModal } = useUI();
  const isOpen = activeModal === id;

  useEffect(() => {
    if (!isOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeModal();
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [isOpen, closeModal]);

  return {
    isOpen,
    open: () => openModal(id),
    close: closeModal,
  };
};
