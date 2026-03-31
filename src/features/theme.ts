const THEME_KEY = 'app_theme';

function getThemeBtn(): HTMLButtonElement {
  return document.getElementById('themeBtn') as HTMLButtonElement;
}

function applyTheme(dark: boolean): void {
  document.documentElement.setAttribute('data-bs-theme', dark ? 'dark' : 'light');
  getThemeBtn().innerHTML = dark ? '<i class="fas fa-moon"></i>' : '<i class="fas fa-sun"></i>';
}

export function loadTheme(): void {
  const saved = localStorage.getItem(THEME_KEY);
  applyTheme(saved !== 'light'); // dark by default
}

export function toggleTheme(): void {
  const isDark = document.documentElement.getAttribute('data-bs-theme') === 'dark';
  const next = !isDark;
  localStorage.setItem(THEME_KEY, next ? 'dark' : 'light');
  applyTheme(next);
}
