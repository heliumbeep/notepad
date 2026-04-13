const SPELLCHECK_KEY = 'spellcheck';

let saveTimeout: ReturnType<typeof setTimeout> | null = null;
let lastSavedContent = '';
let onSaveCallback: (() => void | Promise<void>) | null = null;
let isDirtyFlag = false;

export function initEditor(onSave: () => void | Promise<void>): void {
  onSaveCallback = onSave;

  const editor = getEditor();
  editor.addEventListener('input', () => {
    isDirtyFlag = true;
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
  return getCleanHTML(getEditor().innerHTML);
}

/**
 * Strips out temporary UI elements (handles, toolbars) from the HTML
 * to keep storage clean and prevent "dirty" state false positives.
 */
function getCleanHTML(html: string): string {
  if (!html) return '';
  const temp = document.createElement('div');
  temp.innerHTML = html;
  
  // Remove temporary UI elements
  const selectors = ['.img-handle', '.img-toolbar', '.img-crop-box'];
  selectors.forEach(s => temp.querySelectorAll(s).forEach(el => el.remove()));
  
  // Clean up selection classes and data
  temp.querySelectorAll('.img-block').forEach(el => {
    el.classList.remove('img-block--selected');
    el.removeAttribute('data-cropping');
    el.removeAttribute('data-crop-state');
  });

  return temp.innerHTML.trim();
}

export function setEditorHTML(html: string): void {
  getEditor().innerHTML = html;
  // Initialize with the clean version so we start with a fair comparison
  lastSavedContent = getCleanHTML(html);
  isDirtyFlag = false; // Ensure it's not dirty after loading a file
  updateCharCount();
}

export function isEditorDirty(): boolean {
  return isDirtyFlag;
}

export function markSaved(): void {
  lastSavedContent = getCleanHTML(getEditor().innerHTML);
  isDirtyFlag = false;
}

export function getLastSavedContent(): string {
  return lastSavedContent;
}

export function format(command: string, value?: string): void {
  const editor = getEditor();
  editor.focus();
  document.execCommand(command, false, value ?? undefined);
  isDirtyFlag = true;
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
  saveTimeout = setTimeout(async () => {
    if (isEditorDirty()) {
      await onSaveCallback?.();
      showStatusMessage('Auto-saved');
    }
  }, 500);
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
  if (e.ctrlKey) {
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
    return;
  }

  if (e.key === 'Backspace') {
    handleBackspace(e);
  }
}

function handleBackspace(e: KeyboardEvent): void {
  const sel = window.getSelection();
  if (!sel || !sel.isCollapsed) return;

  const range = sel.getRangeAt(0);
  const container = range.startContainer;
  const offset = range.startOffset;

  if (offset !== 0) return;

  const editor = getEditor();
  let currentLine = container.nodeType === Node.ELEMENT_NODE ? (container as HTMLElement) : container.parentElement;
  if (!currentLine || currentLine === editor) return;

  // Walk up to find the immediate child of the editor (the current "line" block)
  while (currentLine && currentLine.parentElement !== editor) {
    currentLine = currentLine.parentElement;
  }
  if (!currentLine) return;

  const isImageBlock = (node: Node | null) => node && node.nodeType === Node.ELEMENT_NODE && (node as HTMLElement).classList.contains('img-block');

  // Search for an image block in the previous siblings or at the end of the previous line
  let prevNode: Node | null = currentLine.previousSibling;
  
  // Skip empty text nodes between blocks
  while (prevNode && prevNode.nodeType === Node.TEXT_NODE && !prevNode.textContent?.trim()) {
    prevNode = prevNode.previousSibling;
  }

  let targetImage: HTMLElement | null = null;

  if (isImageBlock(prevNode)) {
    targetImage = prevNode as HTMLElement;
  } else if (prevNode && prevNode.nodeType === Node.ELEMENT_NODE) {
    // Check if the previous block ENDS with an image
    let exploration = (prevNode as HTMLElement).lastChild;
    while (exploration && exploration.nodeType === Node.TEXT_NODE && !exploration.textContent?.trim()) {
      exploration = exploration.previousSibling;
    }
    if (isImageBlock(exploration)) {
      targetImage = exploration as HTMLElement;
    }
  }

  if (targetImage) {
    e.preventDefault();
    
    // Move selection to after the image
    const newRange = document.createRange();
    newRange.setStartAfter(targetImage);
    newRange.collapse(true);
    sel.removeAllRanges();
    sel.addRange(newRange);
    
    // If we were on an empty line, delete it to simulate "joining"
    const content = currentLine.innerHTML.replace(/<br\s*\/?>/gi, '').trim();
    if (!content) {
      currentLine.parentNode?.removeChild(currentLine);
    }
    
    triggerAutoSave();
  }
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

  // If enabled on load, force a refresh to highlight existing errors
  if (enabled) {
    forceRefreshSpellcheck(editor);
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

  if (next) {
    forceRefreshSpellcheck(editor);
  }
}

/**
 * Tricky way to force browsers to re-scan the entire content for spelling errors.
 * Simply setting .spellcheck = true often only checks newly typed text.
 */
function forceRefreshSpellcheck(editor: HTMLElement): void {
  // To force a spellcheck scan without clearing content (which causes data loss),
  // we briefly toggle contenteditable and spellcheck.
  const originalSpellcheck = editor.spellcheck;
  editor.setAttribute('contenteditable', 'false');
  editor.spellcheck = false;
  
  // Minimal delay to let the browser process the attribute change
  setTimeout(() => {
    editor.setAttribute('contenteditable', 'true');
    editor.spellcheck = originalSpellcheck;
    // We don't focus or move cursor unless necessary, 
    // to avoid interrupting the user's flow.
  }, 10);
}
