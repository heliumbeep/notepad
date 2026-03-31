import { Modal } from 'bootstrap';
import {
  generateId,
  getFile,
  getFilesIndex,
  saveFile,
  saveFilesIndex,
  deleteFile,
} from '../lib/storage';
import { getEditorHTML, setEditorHTML, markSaved, isEditorDirty, showStatusMessage, updateCharCount, triggerAutoSave } from './editor';
import { reinitImages } from './images';

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

  document.getElementById('saveBtn')!.addEventListener('click', () => {
    saveCurrentFile();
    showStatusMessage('Saved');
  });

  window.addEventListener('beforeunload', () => {
    if (isEditorDirty()) saveCurrentFile();
  });
}


export function getCurrentFileId(): string | null {
  return currentFileId;
}

// ─── CRUD ─────────────────────────────────────────────────────────────────────

export function createNewFile(): void {
  if (currentFileId) saveCurrentFile();
  const id = generateId();
  const name = 'Untitled';
  saveFile(id, name, '');
  const index = getFilesIndex();
  index.push({ id, name });
  saveFilesIndex(index);
  loadFileById(id);
  renderFilesList();
  openRenameModal(id);
}

export function loadFileById(id: string): void {
  if (currentFileId) saveCurrentFile();
  const file = getFile(id);
  currentFileId = id;
  setEditorHTML(file.html ?? '');
  updateFileNameDisplay(file.name);
  showStatusMessage('File loaded');
  setTimeout(() => reinitImages(document.getElementById('editor')!), 0);
}

export function saveCurrentFile(): void {
  if (!currentFileId) return;
  const file = getFile(currentFileId);
  saveFile(currentFileId, file.name, getEditorHTML());
  markSaved();
  const index = getFilesIndex();
  const entry = index.find((f) => f.id === currentFileId);
  if (entry) entry.name = file.name;
  saveFilesIndex(index);
}

export function renameFile(id: string, newName: string): void {
  const trimmed = newName.trim() || 'Untitled';
  const file = getFile(id);
  saveFile(id, trimmed, file.html);
  const index = getFilesIndex();
  const entry = index.find((f) => f.id === id);
  if (entry) entry.name = trimmed;
  saveFilesIndex(index);
  if (id === currentFileId) updateFileNameDisplay(trimmed);
  renderFilesList();
}

function doDeleteFile(id: string): void {
  const index = getFilesIndex();
  if (index.length <= 1) {
    const editor = document.getElementById('editor')!;
    editor.innerHTML = '';
    saveFile(id, getFile(id).name, '');
    markSaved();
    updateCharCount();
    showStatusMessage('Content cleared');
    return;
  }
  deleteFile(id);
  if (id === currentFileId) {
    const remaining = getFilesIndex();
    if (remaining.length > 0) loadFileById(remaining[0].id);
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
  const file = getFile(id);
  const input = document.getElementById('renameInput') as HTMLInputElement;
  input.value = file.name === 'Untitled' ? '' : file.name;
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
        document.getElementById('filesDropdownBtn')
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
