import { triggerAutoSave } from './editor';

// ─── Constants ──────────────────────────────────────────────────────────────

const MIN_IMG_SIZE = 40;

// ─── Public API ───────────────────────────────────────────────────────────────

export function initImagePaste(editor: HTMLElement): void {
  editor.addEventListener('paste', (e: ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (const item of Array.from(items)) {
      // Handle external image files (drag-drop or OS paste)
      if (item.type.startsWith('image/') && item.kind === 'file') {
        e.preventDefault();
        const blob = item.getAsFile();
        if (!blob) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
          if (typeof ev.target?.result === 'string') {
            insertResizableImage(ev.target.result);
            triggerAutoSave();
          }
        };
        reader.readAsDataURL(blob);
        return;
      }
    }

    setTimeout(() => reinitImages(editor), 10);
  });
}

export function reinitImages(editor: HTMLElement): void {
  editor.querySelectorAll<HTMLElement>('.img-block').forEach((block) => {
    const img = block.querySelector('img');
    if (!img) return;
    ensureImageStructure(block);
    setupImageBehavior(block, img);
  });
}

// ─── Insert ──────────────────────────────────────────────────────────────────

function insertResizableImage(src: string): void {
  const block = buildImageBlock(src, 300);

  const sel = window.getSelection();
  if (sel && sel.rangeCount) {
    const range = sel.getRangeAt(0);
    range.deleteContents();
    range.insertNode(block);
    range.setStartAfter(block);
    range.collapse(true);
    sel.removeAllRanges();
    sel.addRange(range);
  } else {
    document.getElementById('editor')?.appendChild(block);
  }
}

function buildImageBlock(src: string, initWidth: number): HTMLElement {
  const block = document.createElement('span');
  block.className = 'img-block';
  block.contentEditable = 'false';
  block.setAttribute('data-img-block', '');
  block.setAttribute('data-aspect-locked', 'true');
  block.setAttribute('data-cropping', 'false');

  const img = document.createElement('img');
  img.src = src;
  img.style.width = initWidth + 'px';
  img.draggable = false;

  block.appendChild(img);
  ensureImageStructure(block);
  setupImageBehavior(block, img);

  return block;
}

function ensureImageStructure(block: HTMLElement): void {
  // 1. Resize handles
  if (!block.querySelector('.img-handle')) {
    (['nw', 'ne', 'sw', 'se'] as const).forEach((pos) => {
      const h = document.createElement('span');
      h.className = `img-handle img-handle--${pos}`;
      h.dataset.pos = pos;
      block.appendChild(h);
    });
  }

  // 2. Toolbar
  if (!block.querySelector('.img-toolbar')) {
    const toolbar = document.createElement('span');
    toolbar.className = 'img-toolbar';
    block.appendChild(toolbar);
  }

  // 3. Crop UI
  let cropBox = block.querySelector('.img-crop-box') as HTMLElement;
  if (!cropBox) {
    cropBox = document.createElement('div');
    cropBox.className = 'img-crop-box';
    block.appendChild(cropBox);
  }

  // Move/ensure handles are inside cropBox
  (['nw', 'ne', 'sw', 'se', 'n', 's', 'e', 'w'] as const).forEach((pos) => {
    if (!cropBox.querySelector(`.crop-handle--${pos}`)) {
      const h = document.createElement('div');
      h.className = `crop-handle crop-handle--${pos}`;
      h.dataset.pos = pos;
      cropBox.appendChild(h);
    }
  });
}

function setupImageBehavior(block: HTMLElement, img: HTMLImageElement): void {
  const toolbar = block.querySelector('.img-toolbar') as HTMLElement;
  setupToolbar(block, img, toolbar);
  attachResizeHandles(block, img);
  attachCropBehavior(block, img);
  attachSelectBehavior(block);
}

// ─── Toolbar ─────────────────────────────────────────────────────────────────

function setupToolbar(block: HTMLElement, img: HTMLImageElement, bar: HTMLElement): void {
  bar.innerHTML = '';

  const isCropping = block.getAttribute('data-cropping') === 'true';
  const isLocked = block.getAttribute('data-aspect-locked') === 'true';

  if (!isCropping) {
    // Lock Button
    const lockBtn = document.createElement('button');
    lockBtn.className = 'img-toolbar-btn' + (isLocked ? ' btn-locked' : '');
    lockBtn.title = isLocked ? 'Unlock aspect ratio' : 'Lock aspect ratio';
    lockBtn.innerHTML = `<i class="fas ${isLocked ? 'fa-lock' : 'fa-lock-open'}"></i>`;
    lockBtn.onclick = (e) => {
      e.stopPropagation();
      const next = !isLocked;
      block.setAttribute('data-aspect-locked', next.toString());
      setupToolbar(block, img, bar);
      triggerAutoSave();
    };

    // Crop Button
    const cropBtn = document.createElement('button');
    cropBtn.className = 'img-toolbar-btn';
    cropBtn.title = 'Crop';
    cropBtn.innerHTML = '<i class="fas fa-crop-alt"></i>';
    cropBtn.onclick = (e) => {
      e.stopPropagation();
      startCropMode(block, img);
    };

    // Delete Button
    const delBtn = document.createElement('button');
    delBtn.className = 'img-toolbar-btn img-toolbar-btn--danger';
    delBtn.title = 'Delete image';
    delBtn.innerHTML = '<i class="fas fa-trash-alt"></i>';
    delBtn.onclick = (e) => {
      e.stopPropagation();
      block.remove();
      triggerAutoSave();
    };

    bar.appendChild(lockBtn);
    bar.appendChild(cropBtn);
    bar.appendChild(delBtn);
  } else {
    // Crop Mode Buttons
    const confirmBtn = document.createElement('button');
    confirmBtn.className = 'img-toolbar-btn img-toolbar-btn--confirm';
    confirmBtn.title = 'Apply Crop';
    confirmBtn.innerHTML = '<i class="fas fa-check"></i>';
    confirmBtn.onclick = (e) => {
      e.stopPropagation();
      applyCrop(block, img);
    };

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'img-toolbar-btn';
    cancelBtn.title = 'Cancel Crop';
    cancelBtn.innerHTML = '<i class="fas fa-times"></i>';
    cancelBtn.onclick = (e) => {
      e.stopPropagation();
      cancelCropMode(block, img);
    };

    bar.appendChild(confirmBtn);
    bar.appendChild(cancelBtn);
  }

  // Dynamic Position: if block is too close to top of viewport/container, move toolbar to bottom.
  adjustToolbarPosition(block, bar);
}

function adjustToolbarPosition(block: HTMLElement, bar: HTMLElement): void {
  // Use timeout to ensure DOM is ready for measurement
  setTimeout(() => {
    const container = document.querySelector('.editor-container');
    if (!container) return;
    const blockRect = block.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();

    // If the top of the block is closer than 40px to the top of the container, flip to bottom
    const spaceAbove = blockRect.top - containerRect.top;
    if (spaceAbove < 40) {
      bar.classList.add('img-toolbar--bottom');
    } else {
      bar.classList.remove('img-toolbar--bottom');
    }
  }, 0);
}

// ─── Resize Logic ────────────────────────────────────────────────────────────

function attachResizeHandles(block: HTMLElement, img: HTMLImageElement): void {
  block.querySelectorAll<HTMLElement>('.img-handle').forEach((handle) => {
    handle.onmousedown = (e) => {
      e.preventDefault();
      e.stopPropagation();

      const pos = handle.dataset.pos ?? 'se';
      const startX = e.clientX;
      const startY = e.clientY;
      const startW = img.offsetWidth;
      const startH = img.offsetHeight;
      const ratio = startW / startH;
      const isLocked = block.getAttribute('data-aspect-locked') === 'true';

      const onMove = (ev: MouseEvent) => {
        const dx = ev.clientX - startX;
        const dy = ev.clientY - startY;

        let newW = startW;
        let newH = startH;

        if (pos.includes('e')) newW = startW + dx;
        if (pos.includes('w')) newW = startW - dx;
        if (pos.includes('s')) newH = startH + dy;
        if (pos.includes('n')) newH = startH - dy;

        newW = Math.max(MIN_IMG_SIZE, newW);
        newH = Math.max(MIN_IMG_SIZE, newH);

        if (isLocked) {
          if (pos === 'e' || pos === 'w' || Math.abs(dx) > Math.abs(dy)) {
            newH = newW / ratio;
          } else {
            newW = newH * ratio;
          }
        }

        img.style.width = newW + 'px';
        img.style.height = newH + 'px';
      };

      const onUp = () => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);

        // After resize, check toolbar position again
        const bar = block.querySelector('.img-toolbar') as HTMLElement;
        if (bar) adjustToolbarPosition(block, bar);

        triggerAutoSave();
      };

      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    };
  });
}

// ─── Crop Logic (In-place) ───────────────────────────────────────────────────

function startCropMode(block: HTMLElement, img: HTMLImageElement): void {
  block.setAttribute('data-cropping', 'true');

  const w = img.offsetWidth;
  const h = img.offsetHeight;
  const sel = { x: 0, y: 0, w, h };
  block.setAttribute('data-crop-state', JSON.stringify(sel));

  updateCropUI(block);
  setupToolbar(block, img, block.querySelector('.img-toolbar') as HTMLElement);
}

function cancelCropMode(block: HTMLElement, img: HTMLImageElement): void {
  block.setAttribute('data-cropping', 'false');
  setupToolbar(block, img, block.querySelector('.img-toolbar') as HTMLElement);
}

function updateCropUI(block: HTMLElement): void {
  const cropBox = block.querySelector('.img-crop-box') as HTMLElement;
  const stateStr = block.getAttribute('data-crop-state');
  if (!cropBox || !stateStr) return;

  const { x, y, w, h } = JSON.parse(stateStr);
  cropBox.style.left = x + 'px';
  cropBox.style.top = y + 'px';
  cropBox.style.width = w + 'px';
  cropBox.style.height = h + 'px';
}

function attachCropBehavior(block: HTMLElement, img: HTMLImageElement): void {
  const cropBox = block.querySelector('.img-crop-box') as HTMLElement;
  if (!cropBox) return;

  // Box drag (move entire selection)
  cropBox.onmousedown = (e) => {
    if ((e.target as HTMLElement).classList.contains('crop-handle')) return;
    e.preventDefault();
    e.stopPropagation();

    const startX = e.clientX;
    const startY = e.clientY;
    const startState = JSON.parse(block.getAttribute('data-crop-state') || '{}');
    const imgW = img.offsetWidth;
    const imgH = img.offsetHeight;

    const onMove = (ev: MouseEvent) => {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;

      const nextX = Math.max(0, Math.min(imgW - startState.w, startState.x + dx));
      const nextY = Math.max(0, Math.min(imgH - startState.h, startState.y + dy));

      block.setAttribute('data-crop-state', JSON.stringify({ ...startState, x: nextX, y: nextY }));
      updateCropUI(block);
    };

    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  // Handle drag (resize selection)
  block.querySelectorAll<HTMLElement>('.crop-handle').forEach((handle) => {
    handle.onmousedown = (e) => {
      e.preventDefault();
      e.stopPropagation();

      const pos = handle.dataset.pos ?? 'se';
      const startX = e.clientX;
      const startY = e.clientY;
      const startState = JSON.parse(block.getAttribute('data-crop-state') || '{}');
      const imgW = img.offsetWidth;
      const imgH = img.offsetHeight;

      const onMove = (ev: MouseEvent) => {
        const dx = ev.clientX - startX;
        const dy = ev.clientY - startY;

        let { x, y, w, h } = { ...startState };

        if (pos.includes('e')) w = Math.max(10, Math.min(imgW - x, startState.w + dx));
        if (pos.includes('s')) h = Math.max(10, Math.min(imgH - y, startState.h + dy));

        if (pos.includes('w')) {
          const nextX = Math.max(0, Math.min(startState.x + startState.w - 10, startState.x + dx));
          w = startState.w + (startState.x - nextX);
          x = nextX;
        }
        if (pos.includes('n')) {
          const nextY = Math.max(0, Math.min(startState.y + startState.h - 10, startState.y + dy));
          h = startState.h + (startState.y - nextY);
          y = nextY;
        }

        block.setAttribute('data-crop-state', JSON.stringify({ x, y, w, h }));
        updateCropUI(block);
      };

      const onUp = () => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
      };

      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    };
  });
}

function applyCrop(block: HTMLElement, img: HTMLImageElement): void {
  const stateStr = block.getAttribute('data-crop-state');
  if (!stateStr) return cancelCropMode(block, img);

  const { x, y, w, h } = JSON.parse(stateStr);
  if (w < 5 || h < 5) return cancelCropMode(block, img);

  const natImg = new Image();
  natImg.crossOrigin = "anonymous";
  natImg.src = img.src;

  natImg.onload = () => {
    const scale = natImg.naturalWidth / img.offsetWidth;
    const canvas = document.createElement('canvas');
    canvas.width = w * scale;
    canvas.height = h * scale;

    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(
      natImg,
      x * scale, y * scale,
      w * scale, h * scale,
      0, 0,
      canvas.width, canvas.height
    );

    img.src = canvas.toDataURL('image/png');
    img.style.width = w + 'px';
    img.style.height = h + 'px';

    cancelCropMode(block, img);
    triggerAutoSave();
  };

  natImg.onerror = () => {
    console.error("Failed to load image for cropping");
    cancelCropMode(block, img);
  };
}

// ─── Select / deselect ───────────────────────────────────────────────────────

function attachSelectBehavior(block: HTMLElement): void {
  block.onclick = (e) => {
    e.stopPropagation();
    if (block.getAttribute('data-cropping') === 'true') return;
    deselectAll();
    block.classList.add('img-block--selected');

    // Check toolbar position on selection
    const bar = block.querySelector('.img-toolbar') as HTMLElement;
    if (bar) adjustToolbarPosition(block, bar);
  };
}

function deselectAll(): void {
  document.querySelectorAll('.img-block--selected').forEach((el) =>
    el.classList.remove('img-block--selected')
  );
}

document.addEventListener('copy', (e) => {
  const selected = document.querySelector('.img-block--selected');
  // If we have an image selected and there's no native text selection,
  // manually put the image HTML into the clipboard.
  if (selected && (!window.getSelection() || window.getSelection()?.toString() === '')) {
    const clipboardData = e.clipboardData;
    if (clipboardData) {
      e.preventDefault();
      const html = selected.outerHTML;
      clipboardData.setData('text/html', html);
      clipboardData.setData('text/plain', '[Image]');
    }
  }
});

document.addEventListener('click', (e) => {
  const target = e.target as HTMLElement;
  if (!target.closest('.img-block')) deselectAll();
});

document.addEventListener('keydown', (e) => {
  if (e.key !== 'Delete' && e.key !== 'Backspace') return;
  const active = document.activeElement as HTMLElement;
  if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) return;
  const selected = document.querySelector('.img-block--selected');
  if (selected) {
    e.preventDefault();
    selected.remove();
    triggerAutoSave();
  }
});
