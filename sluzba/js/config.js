// EviDelo – nastavitve

export const FIREBASE_URL = 'https://jasa-petrinjak-default-rtdb.europe-west1.firebasedatabase.app';

// Začetna uporabnika (ustvarita se ob prvi prijavi, če ju v bazi še ni).
// Gesli sta shranjeni samo kot SHA-256 hash s soljo, ne kot čisto besedilo.
export const SEED_USERS = [
  {
    id: 'uporabnik',
    ime: 'Uporabnik',
    priimek: '1',
    username: 'uporabnik',
    salt: 'a41c9e07b2d35f68',
    hash: '453709caa3280a2d2d83102af3f9781600787e9e7c77022f274828d0d0c7cfda',
  },
  {
    id: 'jasa',
    ime: 'Jaša',
    priimek: 'Petrinjak',
    username: 'Jasa',
    salt: '7be0d92c15a8f347',
    hash: 'b3839df4a8009fe4307d48226c778859f6cfa944a7348a822e8a8ddae5cf26c6',
  },
  {
    id: 'admin',
    ime: 'Administrator',
    priimek: '',
    username: 'ADMIN',
    salt: 'c3d81f0a9e5b7264',
    hash: '8b6c77a996ab5a5f3790657e9a9cb26b9bc6b7e3f74e093d7e74abe96cefda67',
    role: 'admin',
  },
];

// Najdaljša možna izmena pri ročnem vpisu (varovalka pred zatipkanimi urami)
export const MAX_SHIFT_MIN = 16 * 60;
// Če izmena "teče" dlje kot toliko časa, aplikacija vpraša po uri odhoda
export const STALE_RUNNING_MS = 16 * 3600 * 1000;

export const APP_VERSION = '2.1';
