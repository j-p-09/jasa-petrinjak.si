// EviDelo – stanje namestitve PWA
export const install = { prompt: null, listeners: new Set() };
const emit = () => install.listeners.forEach((f) => f());

export const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
export const isIOS = () =>
  /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

try {
  if (isStandalone()) localStorage.setItem('evidelo.installed', '1');
} catch {
  /* ignoriraj */
}
export const wasInstalled = () => {
  try {
    return localStorage.getItem('evidelo.installed') === '1';
  } catch {
    return false;
  }
};

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  install.prompt = e;
  emit();
});
window.addEventListener('appinstalled', () => {
  install.prompt = null;
  try {
    localStorage.setItem('evidelo.installed', '1');
  } catch {
    /* ignoriraj */
  }
  emit();
});

export async function runInstall() {
  if (!install.prompt) return false;
  install.prompt.prompt();
  const r = await install.prompt.userChoice;
  install.prompt = null;
  emit();
  return r.outcome === 'accepted';
}
