const NAVBAR_KEY = 'navbar_collapsed';

function getNavbar() {
  return document.getElementById('navbar') as HTMLElement;
}
function getFloating() {
  return document.getElementById('floatingExpand') as HTMLElement;
}

export function collapseNavbar(): void {
  getNavbar().classList.add('collapsed');
  getFloating().classList.add('visible');
  localStorage.setItem(NAVBAR_KEY, 'true');
}

export function expandNavbar(): void {
  getNavbar().classList.remove('collapsed');
  getFloating().classList.remove('visible');
  localStorage.setItem(NAVBAR_KEY, 'false');
}

export function loadNavbarState(): void {
  if (localStorage.getItem(NAVBAR_KEY) === 'true') {
    getNavbar().classList.add('collapsed');
    getFloating().classList.add('visible');
  }
}
