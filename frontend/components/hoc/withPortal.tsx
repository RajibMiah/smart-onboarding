"use client";

import { useEffect, useState, type ComponentType } from "react";
import { createPortal } from "react-dom";

const PORTAL_ROOT_ID = "portal-root";

function getOrCreatePortalRoot(): HTMLElement {
  let root = document.getElementById(PORTAL_ROOT_ID);
  if (!root) {
    root = document.createElement("div");
    root.id = PORTAL_ROOT_ID;
    document.body.appendChild(root);
  }
  return root;
}

/**
 * Wraps `Component` so it renders into a dedicated `#portal-root` node at the
 * end of `<body>` instead of in-place — keeps modals/menus out of ancestor
 * `overflow: hidden` / `transform` contexts that would otherwise clip them.
 */
export function withPortal<P extends object>(Component: ComponentType<P>) {
  function Portaled(props: P) {
    // Portals are DOM-only; guard until after mount so SSR output stays inert.
    const [mounted, setMounted] = useState(false);
    useEffect(() => setMounted(true), []);

    if (!mounted) return null;
    return createPortal(<Component {...props} />, getOrCreatePortalRoot());
  }

  Portaled.displayName = `withPortal(${Component.displayName ?? Component.name ?? "Component"})`;
  return Portaled;
}
