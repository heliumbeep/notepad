import type { FileIndexEntry } from '../types';

// ─── Keys ─────────────────────────────────────────────────────────────────────

const FILES_INDEX_KEY = 'notes_files_index';
const LAST_FILE_KEY   = 'notes_last_file_id';

// ─── ID Generator ─────────────────────────────────────────────────────────────

export function generateId(): string {
  return 'f' + Date.now() + Math.random().toString(36).slice(2, 6);
}

// ─── File Index (stays in localStorage — tiny, needs to be sync) ─────────────

export function getFilesIndex(): FileIndexEntry[] {
  try {
    return JSON.parse(localStorage.getItem(FILES_INDEX_KEY) ?? '[]') ?? [];
  } catch {
    return [];
  }
}

export function saveFilesIndex(index: FileIndexEntry[]): void {
  try {
    localStorage.setItem(FILES_INDEX_KEY, JSON.stringify(index));
  } catch {
    /* ignore — index is tiny, this should never fail */
  }
}

// ─── Last Opened File ─────────────────────────────────────────────────────────

export function getLastOpenedFileId(): string | null {
  return localStorage.getItem(LAST_FILE_KEY);
}

export function setLastOpenedFileId(id: string): void {
  localStorage.setItem(LAST_FILE_KEY, id);
}

// ─── Legacy Migration Trigger ─────────────────────────────────────────────────

/**
 * Called once at startup.  
 * Any actual file-content migration (localStorage → IndexedDB) is done
 * by `dbMigrateFromLocalStorage()` in db.ts. This function handles the
 * old single-note format ("fight_cave_notes") that predates the multi-file system.
 */
export function migrateLegacy(): void {
  const legacy = localStorage.getItem('fight_cave_notes');
  if (!legacy || getFilesIndex().length > 0) return;
  try {
    const data = JSON.parse(legacy);
    const id = generateId();
    // Store a placeholder entry in the index so db.ts has something to migrate
    localStorage.setItem('notes_file_' + id, JSON.stringify({ id, name: 'Untitled', html: data.html ?? '', lastEdited: '' }));
    saveFilesIndex([{ id, name: 'Untitled' }]);
    localStorage.removeItem('fight_cave_notes');
  } catch {
    /* ignore */
  }
}
