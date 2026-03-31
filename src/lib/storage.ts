import type { NoteFile, FileIndexEntry } from '../types';

const FILES_INDEX_KEY = 'notes_files_index';
const FILE_PREFIX = 'notes_file_';

export function generateId(): string {
  return 'f' + Date.now() + Math.random().toString(36).slice(2, 6);
}

export function getFilesIndex(): FileIndexEntry[] {
  try {
    return JSON.parse(localStorage.getItem(FILES_INDEX_KEY) ?? '[]') ?? [];
  } catch {
    return [];
  }
}

export function saveFilesIndex(index: FileIndexEntry[]): void {
  localStorage.setItem(FILES_INDEX_KEY, JSON.stringify(index));
}

export function getFile(id: string): NoteFile {
  try {
    const raw = localStorage.getItem(FILE_PREFIX + id);
    return raw ? JSON.parse(raw) : { id, name: 'Untitled', html: '', lastEdited: '' };
  } catch {
    return { id, name: 'Untitled', html: '', lastEdited: '' };
  }
}

export function saveFile(id: string, name: string, html: string): void {
  const data: NoteFile = { id, name, html, lastEdited: new Date().toISOString() };
  localStorage.setItem(FILE_PREFIX + id, JSON.stringify(data));
}

export function deleteFile(id: string): void {
  localStorage.removeItem(FILE_PREFIX + id);
  saveFilesIndex(getFilesIndex().filter((f) => f.id !== id));
}

export function migrateLegacy(): void {
  const legacy = localStorage.getItem('fight_cave_notes');
  if (!legacy || getFilesIndex().length > 0) return;
  try {
    const data = JSON.parse(legacy);
    const id = generateId();
    saveFile(id, 'Untitled', data.html ?? '');
    saveFilesIndex([{ id, name: 'Untitled' }]);
    localStorage.removeItem('fight_cave_notes');
  } catch {
    /* ignore */
  }
}
