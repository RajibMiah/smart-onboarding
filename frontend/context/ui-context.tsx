"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";

import type { AppUser } from "@/lib/types";

const SIDEBAR_COLLAPSED_STORAGE_KEY = "apc.sidebar-collapsed";

interface UIContextValue {
  /** Desktop sidebar collapsed/expanded — persisted across reloads. */
  sidebarCollapsed: boolean;
  toggleSidebarCollapsed: () => void;

  /** Mobile off-canvas drawer — session-only, not persisted. */
  mobileSidebarOpen: boolean;
  openMobileSidebar: () => void;
  closeMobileSidebar: () => void;

  /** Single active modal, addressed by id, so only one can be open at a time. */
  activeModal: string | null;
  openModal: (id: string) => void;
  closeModal: () => void;

  user: AppUser;
  /** Uploaded profile picture (object URL) — shared so the navbar and the
   *  account page's avatar stay in sync; null falls back to initials. */
  avatarUrl: string | null;
  setAvatarUrl: (url: string | null) => void;
}

const UIContext = createContext<UIContextValue | null>(null);

const MOCK_USER: AppUser = {
  name: "Rajib",
  email: "rajib.miah.new@gmail.com",
  initials: "R",
};

/**
 * Tiny external store for the persisted sidebar flag. Reading/writing
 * localStorage during render (via `useSyncExternalStore`) — rather than
 * setting state from an effect — is React's sanctioned way to synchronize
 * with an external system without a cascading-render pass, and it keeps the
 * server snapshot (always expanded) as the correct pre-hydration value.
 */
const sidebarStoreListeners = new Set<() => void>();
let cachedSidebarCollapsed: boolean | null = null;

function readSidebarCollapsed(): boolean {
  try {
    return window.localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

function getSidebarSnapshot(): boolean {
  cachedSidebarCollapsed ??= readSidebarCollapsed();
  return cachedSidebarCollapsed;
}

function getSidebarServerSnapshot(): boolean {
  return false;
}

function subscribeToSidebar(listener: () => void): () => void {
  sidebarStoreListeners.add(listener);
  return () => sidebarStoreListeners.delete(listener);
}

function setSidebarCollapsedStore(value: boolean): void {
  cachedSidebarCollapsed = value;
  try {
    window.localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, String(value));
  } catch {
    // Non-fatal: state still updates for this session even if it can't persist.
  }
  sidebarStoreListeners.forEach((listener) => listener());
}

export function UIProvider({ children }: { children: ReactNode }) {
  const sidebarCollapsed = useSyncExternalStore(
    subscribeToSidebar,
    getSidebarSnapshot,
    getSidebarServerSnapshot,
  );
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  const toggleSidebarCollapsed = useCallback(() => {
    setSidebarCollapsedStore(!getSidebarSnapshot());
  }, []);

  const openMobileSidebar = useCallback(() => setMobileSidebarOpen(true), []);
  const closeMobileSidebar = useCallback(() => setMobileSidebarOpen(false), []);

  const openModal = useCallback((id: string) => setActiveModal(id), []);
  const closeModal = useCallback(() => setActiveModal(null), []);

  const value = useMemo<UIContextValue>(
    () => ({
      sidebarCollapsed,
      toggleSidebarCollapsed,
      mobileSidebarOpen,
      openMobileSidebar,
      closeMobileSidebar,
      activeModal,
      openModal,
      closeModal,
      user: MOCK_USER,
      avatarUrl,
      setAvatarUrl,
    }),
    [
      sidebarCollapsed,
      toggleSidebarCollapsed,
      mobileSidebarOpen,
      openMobileSidebar,
      closeMobileSidebar,
      activeModal,
      openModal,
      closeModal,
      avatarUrl,
    ],
  );

  return <UIContext.Provider value={value}>{children}</UIContext.Provider>;
}

export function useUI(): UIContextValue {
  const ctx = useContext(UIContext);
  if (!ctx) throw new Error("useUI must be used within a <UIProvider>");
  return ctx;
}
