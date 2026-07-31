/* =========================================================
   APARIENCIA: tema claro/oscuro y tamaño de letra
   Se guardan en localStorage (no en el DB) porque son
   preferencias del dispositivo, no datos de las deudas: si
   abrís el mismo respaldo en otra compu, cada una mantiene
   la suya. El valor inicial ya lo aplica un script inline en
   index.html para evitar el parpadeo al cargar.
   ========================================================= */
const THEME_KEY = 'ld-theme';
const FS_KEY = 'ld-fs';
const THEMES = ['auto', 'light', 'dark'];
const SIZES = ['sm', 'md', 'lg', 'xl'];
const THEME_LABEL = { auto: 'Automático', light: 'Claro', dark: 'Oscuro' };

/** Suscriptores que necesitan repintarse al cambiar el tema (los gráficos). */
const listeners = new Set();
export function onThemeChange(fn) { listeners.add(fn); }

function read(key, fallback, valid) {
  try {
    const v = localStorage.getItem(key);
    return valid.includes(v) ? v : fallback;
  } catch (e) { return fallback; }
}
function write(key, value) {
  try { localStorage.setItem(key, value); } catch (e) { /* modo privado: se pierde al cerrar */ }
}

export const getTheme = () => read(THEME_KEY, 'auto', THEMES);
export const getFontSize = () => read(FS_KEY, 'md', SIZES);

/** ¿Se está viendo oscuro ahora mismo? Resuelve el caso "auto". */
export function isDark() {
  const t = getTheme();
  if (t === 'dark') return true;
  if (t === 'light') return false;
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

/** Devuelve el valor real de una variable CSS del tema activo,
 *  para que Chart.js pinte con la misma paleta. */
export function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

export function setTheme(theme) {
  const t = THEMES.includes(theme) ? theme : 'auto';
  document.documentElement.setAttribute('data-theme', t);
  write(THEME_KEY, t);
  syncThemeButton();
  listeners.forEach(fn => fn());
}

export function setFontSize(size) {
  const s = SIZES.includes(size) ? size : 'md';
  document.documentElement.setAttribute('data-fs', s);
  write(FS_KEY, s);
  syncFsButtons();
  listeners.forEach(fn => fn());
}

function syncThemeButton() {
  const btn = document.getElementById('btnTheme');
  if (!btn) return;
  const t = getTheme();
  const dark = isDark();
  btn.setAttribute('aria-pressed', String(dark));
  btn.setAttribute('aria-label', `Tema: ${THEME_LABEL[t]}. Cambiar tema`);
  btn.title = `Tema: ${THEME_LABEL[t]} — clic para cambiar`;
  const label = document.getElementById('themeLabel');
  if (label) label.textContent = THEME_LABEL[t];
}

function syncFsButtons() {
  const current = getFontSize();
  document.querySelectorAll('.fs-control [data-fs]').forEach(b => {
    b.setAttribute('aria-pressed', String(b.dataset.fs === current));
    const names = { sm: 'pequeña', md: 'normal', lg: 'grande' };
    b.setAttribute('aria-label', `Letra ${names[b.dataset.fs] || b.dataset.fs}`);
  });
}

export function initAppearance() {
  // El script inline ya puso los atributos; acá sólo se sincroniza la UI.
  syncThemeButton();
  syncFsButtons();

  const btn = document.getElementById('btnTheme');
  if (btn) btn.onclick = () => {
    // Cicla auto → claro → oscuro → auto
    const next = THEMES[(THEMES.indexOf(getTheme()) + 1) % THEMES.length];
    setTheme(next);
  };

  document.querySelectorAll('.fs-control [data-fs]').forEach(b => {
    b.onclick = () => setFontSize(b.dataset.fs);
  });

  // Si el tema es "auto" y el sistema cambia (modo noche), hay que repintar
  // los gráficos, que llevan colores calculados en JS.
  if (window.matchMedia) {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => { if (getTheme() === 'auto') { syncThemeButton(); listeners.forEach(fn => fn()); } };
    mq.addEventListener ? mq.addEventListener('change', onChange) : mq.addListener(onChange);
  }
}
