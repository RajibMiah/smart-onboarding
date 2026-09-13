"use client";

import { useCallback, useEffect, useState } from "react";

import { pagesApi, ApiError, type ApiDocumentationPage } from "@/lib/api-client";
import type { PageItem } from "@/types/library";

const slugify = (seed: string): string => {
  const base = seed
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  return `${base || "page"}-${Date.now().toString(36)}`;
};

const toPageItem = (page: ApiDocumentationPage): PageItem => {
  return {
    id: page.id,
    title: page.title,
    status: page.status,
    createdAt: page.created_at,
    updatedAt: page.updated_at,
    views: 0,
    sectionCount: page.section_count,
  };
};

/** Real-backend replacement for the old `MOCK_PAGES` array. */
export const usePages = () => {
  const [pages, setPages] = useState<PageItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      const page = await pagesApi.list({ ordering: "-updated_at" });
      setPages(page.results.map(toPageItem));
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't load pages.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    pagesApi.list({ ordering: "-updated_at" }).then(
      (page) => {
        if (cancelled) return;
        setPages(page.results.map(toPageItem));
        setError(null);
        setIsLoading(false);
      },
      (err: unknown) => {
        if (cancelled) return;
        setError(err instanceof ApiError ? err.message : "Couldn't load pages.");
        setIsLoading(false);
      },
    );
    return () => {
      cancelled = true;
    };
  }, []);

  const createPage = useCallback(async (title: string) => {
    const created = await pagesApi.create({ title, slug: slugify(title) });
    const item = toPageItem(created);
    setPages((prev) => [item, ...prev]);
    return item;
  }, []);

  const removePage = useCallback(
    async (id: string) => {
      const previous = pages;
      setPages((prev) => prev.filter((page) => page.id !== id));
      try {
        await pagesApi.remove(id);
      } catch {
        setPages(previous);
      }
    },
    [pages],
  );

  const duplicatePage = useCallback(
    async (id: string) => {
      const source = pages.find((page) => page.id === id);
      if (!source) return;
      const created = await pagesApi.create({ title: `${source.title} (copy)`, slug: slugify(`${source.title}-copy`) });
      setPages((prev) => [toPageItem(created), ...prev]);
    },
    [pages],
  );

  const renamePage = useCallback(async (id: string, title: string) => {
    setPages((prev) => prev.map((page) => (page.id === id ? { ...page, title } : page)));
    try {
      await pagesApi.update(id, { title });
    } catch {
      // best-effort optimistic update; a manual refresh will reconcile
    }
  }, []);

  return { pages, isLoading, error, refresh, createPage, removePage, duplicatePage, renamePage };
};
