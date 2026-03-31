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
import { migrateLegacy, getFilesIndex, generateId, saveFile, saveFilesIndex } from './lib/storage';

// Make bootstrap available globally for dropdown interop used in files.ts
(window as any).bootstrap = bootstrap;

// ─── Boot ─────────────────────────────────────────────────────────────────────

function boot(): void {
  loadTheme();
  loadNavbarState();

  // Editor (must come before files so autosave callback is ready)
  initEditor(saveCurrentFile);
  loadSpellcheck();

  // Files
  initFiles();

  // Images
  const editor = document.getElementById('editor')!;
  initImagePaste(editor);

  // Import / Export
  initImportExport();

  // Migrate legacy data then load initial file
  migrateLegacy();
  const index = getFilesIndex();
  if (index.length > 0) {
    loadFileById(index[0].id);
  } else {
    const id = generateId();
    saveFile(id, 'Untitled', '');
    saveFilesIndex([{ id, name: 'Untitled' }]);
    loadFileById(id);
  }

  renderFilesList();
  updateCharCount();

  // ─── Toolbar event listeners ────────────────────────────────────────────────
  document.getElementById('boldBtn')!.addEventListener('click', () => format('bold'));
  document.getElementById('italicBtn')!.addEventListener('click', () => format('italic'));
  document.getElementById('underlineBtn')!.addEventListener('click', () => format('underline'));
  document.getElementById('spellBtn')!.addEventListener('click', toggleSpellcheck);

  (document.getElementById('fontSize') as HTMLSelectElement).addEventListener('change', (e) =>
    format('fontSize', (e.target as HTMLSelectElement).value)
  );

  (document.getElementById('textColor') as HTMLInputElement).addEventListener('input', (e) =>
    format('foreColor', (e.target as HTMLInputElement).value)
  );

  document.getElementById('themeBtn')!.addEventListener('click', toggleTheme);
  document.getElementById('collapseBtn')!.addEventListener('click', collapseNavbar);
  document.getElementById('floatingExpandBtn')!.addEventListener('click', expandNavbar);
}

boot();
