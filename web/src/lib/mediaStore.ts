/**
 * IndexedDB-backed media store for large binary assets (images, audio, video).
 * Replaces localStorage base64 storage — avoids the 5-10 MB quota crash.
 *
 * All keys are namespaced so multiple asset types can share one DB.
 * API mirrors a simple key-value map: get / set / delete / clear.
 */

const DB_NAME = "link2video-media";
const DB_VERSION = 1;
const STORE_NAME = "assets";

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE_NAME);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function mediaGet(key: string): Promise<string | undefined> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const req = tx.objectStore(STORE_NAME).get(key);
      req.onsuccess = () => resolve(req.result as string | undefined);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return undefined;
  }
}

export async function mediaSet(key: string, value: string): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // Silent fail — caller still has in-memory copy
  }
}

export async function mediaDelete(key: string): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve(); // non-fatal
    });
  } catch {
    // ignore
  }
}

export async function mediaClear(prefix: string): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAllKeys();
      req.onsuccess = () => {
        const keys = req.result as string[];
        keys.filter(k => k.startsWith(prefix)).forEach(k => store.delete(k));
        resolve();
      };
      req.onerror = () => resolve();
    });
  } catch {
    // ignore
  }
}

/** Helpers for typed namespaced keys */
export const storyboardKey = (sceneId: number) => `storyboard:${sceneId}`;
export const audioKey = (sceneId: number) => `audio:${sceneId}`;
export const videoKey = (sceneId: number) => `video:${sceneId}`;
