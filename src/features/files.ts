import { Modal } from 'bootstrap';
import {
  generateId,
  getFilesIndex,
  saveFilesIndex,
  setLastOpenedFileId,
} from '../lib/storage';
import {
  dbGetFile,
  dbSaveFile,
  dbDeleteFile,
  type SaveResult,
} from '../lib/db';
import {
  getEditorHTML,
  setEditorHTML,
  markSaved,
  showStatusMessage,
  updateCharCount,
  triggerAutoSave,
} from './editor';
import { reinitImages } from './images';
import { showStorageError, updateStorageIndicator } from './notify';

let currentFileId: string | null = null;
let renamingFileId: string | null = null;
let pendingDeleteId: string | null = null;

let bsConfirmModal: Modal | null = null;
let bsRenameModal: Modal | null = null;
let bsDeleteModal: Modal | null = null;

export function initFiles(): void {
  bsConfirmModal = new Modal(document.getElementById('confirmModal')!);
  bsRenameModal = new Modal(document.getElementById('renameModal')!);
  bsDeleteModal = new Modal(document.getElementById('deleteFileModal')!);

  document.getElementById('confirmYes')!.addEventListener('click', () => {
    const editor = document.getElementById('editor')!;
    editor.innerHTML = '';
    updateCharCount();
    triggerAutoSave();
    showStatusMessage('Content cleared');
    bsConfirmModal!.hide();
  });

  document.getElementById('confirmNo')!.addEventListener('click', () => bsConfirmModal!.hide());

  document.getElementById('renameConfirm')!.addEventListener('click', () => {
    if (!renamingFileId) return;
    const input = document.getElementById('renameInput') as HTMLInputElement;
    renameFile(renamingFileId, input.value);
    renamingFileId = null;
    bsRenameModal!.hide();
  });

  (document.getElementById('renameInput') as HTMLInputElement).addEventListener('keydown', (e) => {
    if (e.key === 'Enter') (document.getElementById('renameConfirm') as HTMLButtonElement).click();
    if (e.key === 'Escape') bsRenameModal!.hide();
  });

  document.getElementById('deleteFileYes')!.addEventListener('click', () => {
    if (pendingDeleteId) {
      doDeleteFile(pendingDeleteId);
      pendingDeleteId = null;
      bsDeleteModal!.hide();
    }
  });

  document.getElementById('newFileBtn')!.addEventListener('click', createNewFile);

  document.getElementById('fileNameDisplay')!.addEventListener('dblclick', () => {
    if (currentFileId) openRenameModal(currentFileId);
  });

  document.getElementById('clearBtn')!.addEventListener('click', () => bsConfirmModal!.show());

  document.getElementById('saveBtn')!.addEventListener('click', async () => {
    await saveCurrentFile();
    showStatusMessage('Saved');
    // Wait 1s for IndexedDB to flush before querying storage estimate
    setTimeout(updateStorageIndicator, 1000);
  });

  // NOTE: No beforeunload save — IndexedDB is async and can't complete before unload.
  // The 500ms autosave (in editor.ts) covers this.
}

export function getCurrentFileId(): string | null {
  return currentFileId;
}

// ─── CRUD ─────────────────────────────────────────────────────────────────────

export async function createNewFile(): Promise<void> {
  await saveCurrentFile();
  const id = generateId();
  const name = 'Untitled';
  await dbSaveFile(id, name, '');
  const index = getFilesIndex();
  index.push({ id, name });
  saveFilesIndex(index);
  await loadFileById(id);
  renderFilesList();
  openRenameModal(id);
}

export async function loadFileById(id: string): Promise<void> {
  if (currentFileId && currentFileId !== id) await saveCurrentFile();

  const file = await dbGetFile(id);
  currentFileId = id;
  setLastOpenedFileId(id);
  setEditorHTML(file?.html ?? '');
  updateFileNameDisplay(file?.name ?? 'Untitled');
  showStatusMessage('File loaded');

  reinitImages(document.getElementById('editor')!);
  markSaved();
  renderFilesList();
  // Refresh storage indicator after load
  updateStorageIndicator();
}

export async function saveCurrentFile(): Promise<void> {
  if (!currentFileId) return;

  const content = getEditorHTML();
  const index = getFilesIndex();
  const entry = index.find((f) => f.id === currentFileId);
  const name = entry?.name ?? 'Untitled';

  const result: SaveResult = await dbSaveFile(currentFileId, name, content);

  if (!result.ok) {
    showStatusMessage('Save failed!');
    const saveStatusEl = document.getElementById('saveStatus');
    if (saveStatusEl) {
      saveStatusEl.innerHTML = '<i class="fas fa-exclamation-triangle text-danger"></i>';
      saveStatusEl.title = result.message;
    }
    showStorageError(result.message);
    return;
  }

  markSaved();
  saveFilesIndex(index);
}

export async function renameFile(id: string, newName: string): Promise<void> {
  const trimmed = newName.trim() || 'Untitled';
  const file = await dbGetFile(id);
  await dbSaveFile(id, trimmed, file?.html ?? '');
  const index = getFilesIndex();
  const entry = index.find((f) => f.id === id);
  if (entry) entry.name = trimmed;
  saveFilesIndex(index);
  if (id === currentFileId) updateFileNameDisplay(trimmed);
  renderFilesList();
}

async function doDeleteFile(id: string): Promise<void> {
  const index = getFilesIndex();
  if (index.length <= 1) {
    const editor = document.getElementById('editor')!;
    editor.innerHTML = '';
    await dbSaveFile(id, index[0]?.name ?? 'Untitled', '');
    markSaved();
    updateCharCount();
    showStatusMessage('Content cleared');
    return;
  }
  await dbDeleteFile(id);
  saveFilesIndex(index.filter((f) => f.id !== id));
  if (id === currentFileId) {
    const remaining = getFilesIndex();
    if (remaining.length > 0) await loadFileById(remaining[0].id);
  }
  renderFilesList();
}

// ─── UI helpers ──────────────────────────────────────────────────────────────

function updateFileNameDisplay(name: string): void {
  const el = document.getElementById('fileNameDisplay');
  if (el) el.textContent = name || 'Untitled';
  document.title = (name || 'Untitled') + ' — Notes';
}

function openRenameModal(id: string): void {
  renamingFileId = id;
  const index = getFilesIndex();
  const entry = index.find((f) => f.id === id);
  const input = document.getElementById('renameInput') as HTMLInputElement;
  input.value = entry?.name === 'Untitled' ? '' : (entry?.name ?? '');
  bsRenameModal!.show();
  setTimeout(() => { input.select(); input.focus(); }, 300);
}

export function renderFilesList(): void {
  const container = document.getElementById('filesList')!;
  const index = getFilesIndex();
  container.innerHTML = '';

  if (index.length === 0) {
    container.innerHTML =
      '<li><span class="dropdown-item-text text-secondary small py-1">No files</span></li>';
    return;
  }

  for (const { id, name } of index) {
    const li = document.createElement('li');
    li.className = 'file-item' + (id === currentFileId ? ' active-file' : '');

    const nameSpan = document.createElement('span');
    nameSpan.className = 'file-item-name';
    nameSpan.textContent = name || 'Untitled';
    nameSpan.title = name || 'Untitled';
    nameSpan.addEventListener('click', () => {
      if (id !== currentFileId) loadFileById(id);
      const dd = (window as any).bootstrap?.Dropdown?.getInstance(
        document.getElementById('filesDropdownBtn'),
      );
      dd?.hide();
    });

    const actions = document.createElement('span');
    actions.className = 'file-item-actions';

    const renameBtn = makeIconBtn('fa-pen', 'Rename', () => openRenameModal(id));
    const delBtn = makeIconBtn('fa-trash-alt', 'Delete', () => {
      pendingDeleteId = id;
      bsDeleteModal!.show();
    });
    delBtn.classList.add('del');

    actions.appendChild(renameBtn);
    actions.appendChild(delBtn);
    li.appendChild(nameSpan);
    li.appendChild(actions);
    container.appendChild(li);
  }
}

function makeIconBtn(icon: string, title: string, onClick: () => void): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.className = 'file-item-btn';
  btn.title = title;
  btn.innerHTML = `<i class="fas ${icon}"></i>`;
  btn.addEventListener('mousedown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    onClick();
  });
  return btn;
}
