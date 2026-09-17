"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";

import { authApi, type ApiUser } from "@/lib/api-client";
import type { AppUser } from "@/lib/types";

const SIDEBAR_COLLAPSED_STORAGE_KEY = "apc.sidebar-collapsed";

const EMPTY_USER: AppUser = { name: "", email: "", initials: "" };

const toAppUser = (apiUser: ApiUser): AppUser => {
  const name = apiUser.full_name || apiUser.email;
  const initials = (apiUser.first_name[0] ?? apiUser.email[0] ?? "?").toUpperCase();
  return { name, email: apiUser.email, initials };
};

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
  apiUser: ApiUser | null;
  isLoadingUser: boolean;
  /** Merges freshly-saved fields (e.g. after an account settings save) without a round-trip. */
  updateApiUser: (apiUser: ApiUser) => void;
  logout: () => Promise<void>;

  /** Uploaded profile picture (object URL) — shared so the navbar and the
   *  account page's avatar stay in sync; null falls back to initials. */
  avatarUrl: string | null;
  setAvatarUrl: (url: string | null) => void;
}

const UIContext = createContext<UIContextValue | null>(null);

/**
 * Tiny external store for the persisted sidebar flag. Reading/writing
 * localStorage during render (via `useSyncExternalStore`) — rather than
 * setting state from an effect — is React's sanctioned way to synchronize
 * with an external system without a cascading-render pass, and it keeps the
 * server snapshot (always expanded) as the correct pre-hydration value.
 */
const sidebarStoreListeners = new Set<() => void>();
let cachedSidebarCollapsed: boolean | null = null;

const readSidebarCollapsed = (): boolean => {
  try {
    return window.localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
};

const getSidebarSnapshot = (): boolean => {
  cachedSidebarCollapsed ??= readSidebarCollapsed();
  return cachedSidebarCollapsed;
};

const getSidebarServerSnapshot = (): boolean => {
  return false;
};

const subscribeToSidebar = (listener: () => void): () => void => {
  sidebarStoreListeners.add(listener);
  return () => sidebarStoreListeners.delete(listener);
};

const setSidebarCollapsedStore = (value: boolean): void => {
  cachedSidebarCollapsed = value;
  try {
    window.localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, String(value));
  } catch {
    // Non-fatal: state still updates for this session even if it can't persist.
  }
  sidebarStoreListeners.forEach((listener) => listener());
};

export const UIProvider = ({ children }: { children: ReactNode }) => {
  const router = useRouter();
  const sidebarCollapsed = useSyncExternalStore(
    subscribeToSidebar,
    getSidebarSnapshot,
    getSidebarServerSnapshot,
  );
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [apiUser, setApiUser] = useState<ApiUser | null>(null);
  const [isLoadingUser, setIsLoadingUser] = useState(true);

  useEffect(() => {
    let cancelled = false;
    authApi
      .me()
      .then((fetched) => {
        if (cancelled) return;
        setApiUser(fetched);
        if (fetched.avatar_url) setAvatarUrl(fetched.avatar_url);
        setIsLoadingUser(false);
      })
      .catch(() => {
        if (cancelled) return;
        setIsLoadingUser(false);
        router.replace("/login");
      });
    return () => {
      cancelled = true;
    };
  }, [router]);

  const toggleSidebarCollapsed = useCallback(() => {
    setSidebarCollapsedStore(!getSidebarSnapshot());
  }, []);

  const openMobileSidebar = useCallback(() => setMobileSidebarOpen(true), []);
  const closeMobileSidebar = useCallback(() => setMobileSidebarOpen(false), []);

  const openModal = useCallback((id: string) => setActiveModal(id), []);
  const closeModal = useCallback(() => setActiveModal(null), []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      // authApi.logout() clears local tokens even on failure; proceed to redirect regardless.
    }
    setApiUser(null);
    router.replace("/login");
  }, [router]);

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
      user: apiUser ? toAppUser(apiUser) : EMPTY_USER,
      apiUser,
      isLoadingUser,
      updateApiUser: setApiUser,
      logout,
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
      apiUser,
      isLoadingUser,
      logout,
      avatarUrl,
    ],
  );

  return <UIContext.Provider value={value}>{children}</UIContext.Provider>;
};

export const useUI = (): UIContextValue => {
  const ctx = useContext(UIContext);
  if (!ctx) throw new Error("useUI must be used within a <UIProvider>");
  return ctx;
};
