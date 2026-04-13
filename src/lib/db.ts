import type { NoteFile } from '../types';

// ─── Config ──────────────────────────────────────────────────────────────────

const DB_NAME = 'notepad_db';
const DB_VERSION = 1;
const STORE = 'files';

// ─── Connection ───────────────────────────────────────────────────────────────

let _db: IDBDatabase | null = null;

function openDB(): Promise<IDBDatabase> {
  if (_db) return Promise.resolve(_db);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' });
      }
    };

    req.onsuccess = (e) => {
      _db = (e.target as IDBOpenDBRequest).result;
      resolve(_db);
    };

    req.onerror = () => reject(req.error);
  });
}

// ─── CRUD ─────────────────────────────────────────────────────────────────────

export async function dbGetFile(id: string): Promise<NoteFile | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE, 'readonly').objectStore(STORE).get(id);
    req.onsuccess = () =>
      resolve(req.result ?? { id, name: 'Untitled', html: '', lastEdited: '' });
    req.onerror = () => reject(req.error);
  });
}

export type SaveResult =
  | { ok: true }
  | { ok: false; reason: 'quota' | 'error'; message: string };

export async function dbSaveFile(
  id: string,
  name: string,
  html: string,
): Promise<SaveResult> {
  try {
    const db = await openDB();
    const data: NoteFile = { id, name, html, lastEdited: new Date().toISOString() };
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      const req = tx.objectStore(STORE).put(data);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
      tx.onerror = () => reject(tx.error);
    });
    return { ok: true };
  } catch (e: any) {
    const isQuota = e?.name === 'QuotaExceededError' || e?.code === 22;
    return {
      ok: false,
      reason: isQuota ? 'quota' : 'error',
      message: isQuota
        ? 'No hay espacio de almacenamiento disponible. Tus notas actuales están seguras, pero no puedes añadir más contenido hasta que exportes y elimines algún archivo.'
        : `Error inesperado al guardar: ${e?.message ?? 'desconocido'}`,
    };
  }
}

export async function dbDeleteFile(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const req = tx.objectStore(STORE).delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// ─── Storage Estimate ─────────────────────────────────────────────────────────

export async function dbGetStorageEstimate(): Promise<{ usedMB: number; quotaMB: number } | null> {
  if (!navigator.storage?.estimate) return null;
  const est = await navigator.storage.estimate();
  return {
    usedMB: (est.usage ?? 0) / 1024 / 1024,
    quotaMB: (est.quota ?? 0) / 1024 / 1024,
  };
}

// ─── One-Time Migration from localStorage ─────────────────────────────────────

const LS_FILE_PREFIX = 'notes_file_';
const LS_FILES_INDEX = 'notes_files_index';

/**
 * Checks if there are files stored in localStorage (old format) and imports
 * them into IndexedDB. Runs only once — after import it removes the old data.
 */
export async function dbMigrateFromLocalStorage(): Promise<void> {
  let index: { id: string; name: string }[];
  try {
    index = JSON.parse(localStorage.getItem(LS_FILES_INDEX) ?? '[]') ?? [];
  } catch {
    return;
  }

  if (index.length === 0) return;

  const db = await openDB();

  // Check if IDB already has files — if so, migration already done
  const existingCount: number = await new Promise((resolve, reject) => {
    const req = db.transaction(STORE, 'readonly').objectStore(STORE).count();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

  if (existingCount > 0) {
    // IDB already has data — clean up leftover localStorage file entries
    index.forEach(({ id }) => localStorage.removeItem(LS_FILE_PREFIX + id));
    return;
  }

  // Import each file from localStorage into IndexedDB
  for (const { id, name } of index) {
    const raw = localStorage.getItem(LS_FILE_PREFIX + id);
    if (!raw) continue;
    try {
      const parsed: NoteFile = JSON.parse(raw);
      await dbSaveFile(id, parsed.name ?? name, parsed.html ?? '');
      localStorage.removeItem(LS_FILE_PREFIX + id);
    } catch {
      /* skip corrupted entries */
    }
  }

  console.info('[notepad] Migrated', index.length, 'file(s) from localStorage → IndexedDB');
}
