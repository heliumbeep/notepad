const SPELLCHECK_KEY = 'spellcheck';

let saveTimeout: ReturnType<typeof setTimeout> | null = null;
let lastSavedContent = '';
let onSaveCallback: (() => void) | null = null;

export function initEditor(onSave: () => void): void {
  onSaveCallback = onSave;

  const editor = getEditor();
  editor.addEventListener('input', () => {
    updateCharCount();
    triggerAutoSave();
  });
  editor.addEventListener('keyup', updateCharCount);
  editor.addEventListener('keydown', handleEditorKeydown);
}

function getEditor(): HTMLElement {
  return document.getElementById('editor') as HTMLElement;
}

export function getEditorHTML(): string {
  return getEditor().innerHTML;
}

export function setEditorHTML(html: string): void {
  getEditor().innerHTML = html;
  lastSavedContent = html;
  updateCharCount();
}

export function isEditorDirty(): boolean {
  return getEditor().innerHTML !== lastSavedContent;
}

export function markSaved(): void {
  lastSavedContent = getEditor().innerHTML;
}

export function format(command: string, value?: string): void {
  const editor = getEditor();
  editor.focus();
  document.execCommand(command, false, value ?? undefined);
  updateCharCount();
  triggerAutoSave();
}

export function updateCharCount(): void {
  const editor = getEditor();
  const text = (editor.innerText || editor.textContent || '').replace(/[\n\r]/g, '');
  const el = document.getElementById('charCount');
  if (el) el.innerHTML = `<i class="far fa-keyboard me-1"></i>${text.length}`;
}

export function triggerAutoSave(): void {
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    if (isEditorDirty()) {
      onSaveCallback?.();
      showStatusMessage('Auto-saved');
    }
  }, 1500);
}

export function showStatusMessage(msg: string): void {
  const el = document.getElementById('saveStatus');
  if (!el) return;
  el.innerHTML = '<i class="fas fa-info-circle text-info"></i>';
  el.title = msg;
  setTimeout(() => {
    if (el.innerHTML.includes('info-circle')) {
      el.innerHTML = '<i class="fas fa-check-circle text-success"></i>';
      el.title = 'All saved';
    }
  }, 2000);
}

function handleEditorKeydown(e: KeyboardEvent): void {
  if (!e.ctrlKey) return;
  const key = e.key.toLowerCase();
  if (!['s', 'b', 'i', 'u'].includes(key)) return;
  e.preventDefault();
  if (key === 's') {
    onSaveCallback?.();
    showStatusMessage('Saved');
  }
  if (key === 'b') format('bold');
  if (key === 'i') format('italic');
  if (key === 'u') format('underline');
}

// ---- Spellcheck ----
export function loadSpellcheck(): void {
  const editor = getEditor() as HTMLElement & { spellcheck: boolean };
  const enabled = localStorage.getItem(SPELLCHECK_KEY) === 'true';
  editor.spellcheck = enabled;
  const btn = document.getElementById('spellBtn');
  if (btn) {
    btn.classList.toggle('active', enabled);
    btn.title = enabled ? 'Disable spellcheck' : 'Enable spellcheck';
  }
}

export function toggleSpellcheck(): void {
  const editor = getEditor() as HTMLElement & { spellcheck: boolean };
  const next = !editor.spellcheck;
  editor.spellcheck = next;
  localStorage.setItem(SPELLCHECK_KEY, next ? 'true' : 'false');
  const btn = document.getElementById('spellBtn');
  if (btn) {
    btn.classList.toggle('active', next);
    btn.title = next ? 'Disable spellcheck' : 'Enable spellcheck';
  }

  const html = editor.innerHTML;
  editor.innerHTML = html;
  editor.focus();
}
