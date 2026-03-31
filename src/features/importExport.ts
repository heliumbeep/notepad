import type { ExportData, NoteFile } from '../types';
import { getFile, saveFile, getFilesIndex, saveFilesIndex, generateId } from '../lib/storage';
import { getCurrentFileId, loadFileById, renderFilesList, saveCurrentFile } from './files';
import { showStatusMessage } from './editor';

// ─── Export ───────────────────────────────────────────────────────────────────

export function exportCurrentFile(): void {
  const id = getCurrentFileId();
  if (!id) return;

  saveCurrentFile(); // Ensure latest content is stored
  const file: NoteFile = getFile(id);

  const payload: ExportData = {
    version: 1,
    exportedAt: new Date().toISOString(),
    file,
  };

  const json = JSON.stringify(payload, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = sanitizeFilename(file.name) + '.json';
  a.click();
  URL.revokeObjectURL(url);
  showStatusMessage('Exported');
}

// ─── Import ───────────────────────────────────────────────────────────────────

export function importFile(f: File): void {
  const reader = new FileReader();
  reader.onload = (ev) => {
    try {
      const raw = ev.target?.result as string;
      const data: ExportData = JSON.parse(raw);

      if (data.version !== 1 || !data.file?.html) {
        alert('Invalid file or unknown format.');
        return;
      }

      const { html, name } = data.file;
      const id = generateId();
      const safeName = name?.trim() || 'Imported';

      saveFile(id, safeName, html);
      const index = getFilesIndex();
      index.push({ id, name: safeName });
      saveFilesIndex(index);

      loadFileById(id);
      renderFilesList();
      showStatusMessage('Imported');
    } catch {
      alert('Could not read the file. Is it a valid JSON note?');
    }
  };
  reader.readAsText(f);
}

// ─── Init ─────────────────────────────────────────────────────────────────────

export function initImportExport(): void {
  document.getElementById('exportBtn')?.addEventListener('click', exportCurrentFile);

  const importInput = document.getElementById('importInput') as HTMLInputElement;
  importInput?.addEventListener('change', (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) {
      importFile(file);
      importInput.value = '';
    }
  });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sanitizeFilename(name: string): string {
  return (name || 'nota').replace(/[^a-z0-9\-_\s]/gi, '').trim() || 'nota';
}
