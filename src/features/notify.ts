import { Modal } from 'bootstrap';
import { dbGetStorageEstimate } from '../lib/db';

// ─── Storage Error Modal ───────────────────────────────────────────────────────

let _errorModalEl: HTMLElement | null = null;
let _errorModal: Modal | null = null;

function getErrorModal(): { el: HTMLElement; bs: Modal } {
  if (!_errorModalEl) {
    _errorModalEl = document.createElement('div');
    _errorModalEl.className = 'modal fade';
    _errorModalEl.setAttribute('tabindex', '-1');
    _errorModalEl.setAttribute('aria-hidden', 'true');
    _errorModalEl.innerHTML = `
      <div class="modal-dialog modal-dialog-centered modal-sm">
        <div class="modal-content">
          <div class="modal-body py-3 px-4">
            <p class="mb-1 fw-semibold text-danger">
              <i class="fas fa-exclamation-triangle me-2"></i>No se pudo guardar
            </p>
            <p class="text-secondary mb-0 small notify-error-msg" style="margin-top:4px;"></p>
          </div>
          <div class="modal-footer gap-2 border-0 pt-0 pb-3 px-4 justify-content-end">
            <button type="button" class="btn btn-secondary btn-sm" data-bs-dismiss="modal">Cerrar</button>
          </div>
        </div>
      </div>`;
    document.body.appendChild(_errorModalEl);
    _errorModal = new Modal(_errorModalEl);
  }
  return { el: _errorModalEl, bs: _errorModal! };
}

export function showStorageError(message: string): void {
  const { el, bs } = getErrorModal();
  const msgEl = el.querySelector('.notify-error-msg');
  if (msgEl) msgEl.textContent = message;
  bs.show();
}

// ─── Storage Usage Indicator ──────────────────────────────────────────────────

let _indicatorEl: HTMLElement | null = null;

function getIndicatorEl(): HTMLElement | null {
  if (!_indicatorEl) {
    _indicatorEl = document.getElementById('storageUsage');
  }
  return _indicatorEl;
}

/**
 * Updates the storage usage indicator in the toolbar.
 * Colors: green < 50%, yellow < 80%, red >= 80%.
 */
export async function updateStorageIndicator(): Promise<void> {
  const el = getIndicatorEl();
  if (!el) return;

  const est = await dbGetStorageEstimate();
  if (!est) {
    el.style.display = 'none';
    return;
  }

  const { usedMB, quotaMB } = est;
  const pct = quotaMB > 0 ? usedMB / quotaMB : 0;

  const display = usedMB < 1
    ? `${Math.round(usedMB * 1024)} KB`
    : `${usedMB.toFixed(1)} MB`;

  let color = 'text-success';
  if (pct >= 0.8) color = 'text-danger';
  else if (pct >= 0.5) color = 'text-warning';

  el.innerHTML = `<i class="fas fa-database me-1"></i><span class="${color}">${display}</span>`;
  el.title = `${display} used of ${Math.round(quotaMB)} MB available\nCapacity is dynamically allocated by your browser`;
}
