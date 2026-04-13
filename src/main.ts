import 'bootstrap/dist/css/bootstrap.min.css';
import './style.css';
import * as bootstrap from 'bootstrap';

import { loadTheme, toggleTheme } from './features/theme';
import { loadNavbarState, collapseNavbar, expandNavbar } from './features/navbar';
import {
  initEditor,
  format,
  loadSpellcheck,
  toggleSpellcheck,
  updateCharCount,
} from './features/editor';
import { initImagePaste } from './features/images';
import {
  initFiles,
  loadFileById,
  saveCurrentFile,
  renderFilesList,
} from './features/files';
import { initImportExport } from './features/importExport';
import {
  migrateLegacy,
  getFilesIndex,
  generateId,
  saveFilesIndex,
  getLastOpenedFileId,
} from './lib/storage';
import { dbMigrateFromLocalStorage, dbSaveFile } from './lib/db';
import { updateStorageIndicator } from './features/notify';

// Make bootstrap available globally for dropdown interop used in files.ts
(window as any).bootstrap = bootstrap;

// ─── Boot ─────────────────────────────────────────────────────────────────────

async function boot(): Promise<void> {
  loadTheme();
  loadNavbarState();

  // Editor (must come before files so autosave callback is ready)
  initEditor(saveCurrentFile);

  // Files
  initFiles();

  // Images
  const editor = document.getElementById('editor')!;
  initImagePaste(editor);

  // Import / Export
  initImportExport();

  // ── Migration ──────────────────────────────────────────────────────────────
  // 1. Handle the very old single-note format
  migrateLegacy();
  // 2. Migrate any multi-file localStorage data → IndexedDB (one-time)
  await dbMigrateFromLocalStorage();

  // ── Load initial file ──────────────────────────────────────────────────────
  const index = getFilesIndex();
  const lastId = getLastOpenedFileId();
  const lastFileExists = lastId && index.some((f) => f.id === lastId);

  if (lastFileExists) {
    await loadFileById(lastId!);
  } else if (index.length > 0) {
    await loadFileById(index[0].id);
  } else {
    // No files at all — create the first one
    const id = generateId();
    await dbSaveFile(id, 'Untitled', '');
    saveFilesIndex([{ id, name: 'Untitled' }]);
    await loadFileById(id);
  }

  renderFilesList();
  updateCharCount();

  // Load spellcheck AFTER file is loaded to avoid race conditions
  loadSpellcheck();

  // Initial storage indicator
  updateStorageIndicator();

  // Refresh storage indicator every 30 seconds
  setInterval(updateStorageIndicator, 30_000);

  // ─── Toolbar event listeners ────────────────────────────────────────────────
  document.getElementById('boldBtn')!.addEventListener('click', () => format('bold'));
  document.getElementById('italicBtn')!.addEventListener('click', () => format('italic'));
  document.getElementById('underlineBtn')!.addEventListener('click', () => format('underline'));
  document.getElementById('spellBtn')!.addEventListener('click', toggleSpellcheck);

  (document.getElementById('fontSize') as HTMLSelectElement).addEventListener('change', (e) =>
    format('fontSize', (e.target as HTMLSelectElement).value),
  );

  (document.getElementById('textColor') as HTMLInputElement).addEventListener('input', (e) =>
    format('foreColor', (e.target as HTMLInputElement).value),
  );

  document.getElementById('themeBtn')!.addEventListener('click', toggleTheme);
  document.getElementById('collapseBtn')!.addEventListener('click', collapseNavbar);
  document.getElementById('floatingExpandBtn')!.addEventListener('click', expandNavbar);
}

boot();
