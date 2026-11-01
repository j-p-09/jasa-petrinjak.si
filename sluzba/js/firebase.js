// Tanek ovoj okoli Firebase Realtime Database.
// SDK se naloži iz Googlovega CDN-ja; service worker ga shrani za delo brez povezave.
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {
  getDatabase,
  ref,
  get,
  set,
  update,
  onValue,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js';

let db = null;

export function initDb(url) {
  const app = initializeApp({ databaseURL: url });
  db = getDatabase(app);
  return db;
}

export const R = (path) => (path ? ref(db, path) : ref(db));
export { get, set, update, onValue };
