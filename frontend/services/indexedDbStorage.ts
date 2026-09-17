"use client";

import {
  DRAFT_UPDATED_AT_INDEX,
  STORE_MEDIA_BLOBS,
  STORE_PROJECT_DRAFTS,
  STORE_THUMBNAIL_CACHE,
  STUDIO_DB_NAME,
  STUDIO_DB_VERSION,
  THUMBNAIL_CLIP_ID_INDEX,
  type MediaBlobRecord,
  type ProjectDraft,
  type StorageQuotaEstimate,
  type ThumbnailRecord,
} from "@/types/storage";

const promisifyRequest = <T>(request: IDBRequest<T>): Promise<T> => {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed"));
  });
};

const promisifyTransaction = (transaction: IDBTransaction): Promise<void> => {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("IndexedDB transaction failed"));
    transaction.onabort = () => reject(transaction.error ?? new Error("IndexedDB transaction aborted"));
  });
};

/**
 * Typed wrapper over the browser's native IndexedDB for `apc_studio_db` — three
 * stores this simple don't need the `idb` dependency. One connection is opened
 * lazily and reused; `initDB()` is idempotent and safe to call from anywhere.
 *
 * Every write goes through a real IndexedDB transaction (not React state), so
 * multi-minute recorded blobs never sit in memory as component state and can't
 * trigger `QuotaExceededError` via `localStorage`'s much smaller limit.
 */
class IndexedDbStorageService {
  private dbPromise: Promise<IDBDatabase> | null = null;

  initDB(): Promise<IDBDatabase> {
    if (typeof indexedDB === "undefined") {
      return Promise.reject(new Error("IndexedDB is not available in this environment."));
    }

    this.dbPromise ??= new Promise((resolve, reject) => {
      const request = indexedDB.open(STUDIO_DB_NAME, STUDIO_DB_VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;

        if (!db.objectStoreNames.contains(STORE_MEDIA_BLOBS)) {
          db.createObjectStore(STORE_MEDIA_BLOBS, { keyPath: "id" });
        }

        if (!db.objectStoreNames.contains(STORE_PROJECT_DRAFTS)) {
          const drafts = db.createObjectStore(STORE_PROJECT_DRAFTS, { keyPath: "id" });
          drafts.createIndex(DRAFT_UPDATED_AT_INDEX, "updatedAt");
        }

        if (!db.objectStoreNames.contains(STORE_THUMBNAIL_CACHE)) {
          const thumbnails = db.createObjectStore(STORE_THUMBNAIL_CACHE, { keyPath: "id" });
          thumbnails.createIndex(THUMBNAIL_CLIP_ID_INDEX, "clipId");
        }
      };

      request.onsuccess = () => {
        const db = request.result;
        // If another tab upgrades the schema first, drop this connection so the
        // next initDB() call reopens cleanly instead of blocking that upgrade.
        db.onversionchange = () => {
          db.close();
          this.dbPromise = null;
        };
        resolve(db);
      };

      request.onerror = () => reject(request.error ?? new Error("Failed to open IndexedDB"));
      request.onblocked = () => reject(new Error("IndexedDB upgrade blocked by another open tab."));
    });

    return this.dbPromise;
  }

  private async getStore(
    storeName: string,
    mode: IDBTransactionMode,
  ): Promise<{ store: IDBObjectStore; transaction: IDBTransaction }> {
    const db = await this.initDB();
    const transaction = db.transaction(storeName, mode);
    return { store: transaction.objectStore(storeName), transaction };
  }

  // ---------------------------------------------------------------------
  // media_blobs
  // ---------------------------------------------------------------------

  async saveMediaBlob(id: string, blob: Blob, duration: number): Promise<void> {
    const record: MediaBlobRecord = {
      id,
      blob,
      mimeType: blob.type || "application/octet-stream",
      size: blob.size,
      duration,
      createdAt: new Date().toISOString(),
    };
    const { store, transaction } = await this.getStore(STORE_MEDIA_BLOBS, "readwrite");
    store.put(record);
    await promisifyTransaction(transaction);
  }

  async getMediaBlob(id: string): Promise<Blob | null> {
    const record = await this.getMediaBlobRecord(id);
    return record?.blob ?? null;
  }

  async getMediaBlobRecord(id: string): Promise<MediaBlobRecord | null> {
    const { store } = await this.getStore(STORE_MEDIA_BLOBS, "readonly");
    const record = await promisifyRequest<MediaBlobRecord | undefined>(store.get(id));
    return record ?? null;
  }

  async deleteMediaBlob(id: string): Promise<void> {
    const { store, transaction } = await this.getStore(STORE_MEDIA_BLOBS, "readwrite");
    store.delete(id);
    await promisifyTransaction(transaction);
  }

  // ---------------------------------------------------------------------
  // project_drafts
  // ---------------------------------------------------------------------

  async saveProjectDraft(draft: ProjectDraft): Promise<void> {
    const { store, transaction } = await this.getStore(STORE_PROJECT_DRAFTS, "readwrite");
    store.put(draft);
    await promisifyTransaction(transaction);
  }

  async getProjectDraft(id: string): Promise<ProjectDraft | null> {
    const { store } = await this.getStore(STORE_PROJECT_DRAFTS, "readonly");
    const draft = await promisifyRequest<ProjectDraft | undefined>(store.get(id));
    return draft ?? null;
  }

  /** Most recently updated draft, by the `by_updated_at` index — used to auto-restore on reload. */
  async getLatestDraft(): Promise<ProjectDraft | null> {
    const { store } = await this.getStore(STORE_PROJECT_DRAFTS, "readonly");
    const index = store.index(DRAFT_UPDATED_AT_INDEX);

    return new Promise((resolve, reject) => {
      const request = index.openCursor(null, "prev"); // walk the index backwards = newest first
      request.onsuccess = () => {
        const cursor = request.result;
        resolve(cursor ? (cursor.value as ProjectDraft) : null);
      };
      request.onerror = () => reject(request.error ?? new Error("Failed to read the latest draft"));
    });
  }

  async deleteProjectDraft(id: string): Promise<void> {
    const { store, transaction } = await this.getStore(STORE_PROJECT_DRAFTS, "readwrite");
    store.delete(id);
    await promisifyTransaction(transaction);
  }

  // ---------------------------------------------------------------------
  // thumbnail_cache
  // ---------------------------------------------------------------------

  async cacheThumbnail(clipId: string, timestamp: number, thumbnailBlob: Blob): Promise<void> {
    const record: ThumbnailRecord = { id: `${clipId}_${timestamp}`, clipId, timestamp, imageBlob: thumbnailBlob };
    const { store, transaction } = await this.getStore(STORE_THUMBNAIL_CACHE, "readwrite");
    store.put(record);
    await promisifyTransaction(transaction);
  }

  /**
   * Object URLs for every cached frame of `clipId`, keyed by timestamp. Callers
   * own the returned URLs and must `URL.revokeObjectURL` them when done (e.g.
   * on unmount) — the store only holds the blobs, not live URLs.
   */
  async getThumbnailsForClip(clipId: string): Promise<Map<number, string>> {
    const { store } = await this.getStore(STORE_THUMBNAIL_CACHE, "readonly");
    const index = store.index(THUMBNAIL_CLIP_ID_INDEX);
    const records = await promisifyRequest<ThumbnailRecord[]>(index.getAll(IDBKeyRange.only(clipId)));

    const result = new Map<number, string>();
    for (const record of records) {
      result.set(record.timestamp, URL.createObjectURL(record.imageBlob));
    }
    return result;
  }

  async clearThumbnailsForClip(clipId: string): Promise<void> {
    const { store, transaction } = await this.getStore(STORE_THUMBNAIL_CACHE, "readwrite");
    const index = store.index(THUMBNAIL_CLIP_ID_INDEX);

    await new Promise<void>((resolve, reject) => {
      const cursorRequest = index.openCursor(IDBKeyRange.only(clipId));
      cursorRequest.onsuccess = () => {
        const cursor = cursorRequest.result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        } else {
          resolve();
        }
      };
      cursorRequest.onerror = () => reject(cursorRequest.error ?? new Error("Failed to clear cached thumbnails"));
    });

    await promisifyTransaction(transaction);
  }

  // ---------------------------------------------------------------------
  // Storage quota
  // ---------------------------------------------------------------------

  /** Wraps `navigator.storage.estimate()` — returns zeros where the API isn't supported (e.g. Safari < 15, SSR). */
  async checkStorageQuota(): Promise<StorageQuotaEstimate> {
    if (typeof navigator === "undefined" || !navigator.storage?.estimate) {
      return { usage: 0, quota: 0, percentUsed: 0 };
    }
    const { usage = 0, quota = 0 } = await navigator.storage.estimate();
    const percentUsed = quota > 0 ? Math.round((usage / quota) * 100) : 0;
    return { usage, quota, percentUsed };
  }
}

/** Singleton — one IndexedDB connection shared across the whole Studio session. */
export const indexedDbStorage = new IndexedDbStorageService();
export default indexedDbStorage;
