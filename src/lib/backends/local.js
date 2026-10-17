import { buildSeed } from '../../data/seed.js';
import { applyOps } from '../sync.js';
import { todayISO } from '../dates.js';

// The current prototype storage: everything in this browser. It reads and writes the same
// localStorage key and shape as before, so records saved earlier still load.
const KEY = 'garden-manager-v1';

export function createLocalBackend() {
  let cache = null;
  const persist = () => {
    try { localStorage.setItem(KEY, JSON.stringify(cache)); } catch { /* storage full or blocked: keep working in memory */ }
  };
  return {
    name: 'browser',
    async load() {
      try {
        const raw = localStorage.getItem(KEY);
        if (raw) {
          const s = JSON.parse(raw);
          if (s && s.version === 1 && Array.isArray(s.bookings) && s.settings && s.settings.eventTypes) {
            cache = s;
            return { state: s, role: s.role || 'owner' };
          }
        }
      } catch { /* first run, or storage blocked */ }
      cache = buildSeed(todayISO()); // first run: the made-up demo records
      persist();
      return { state: cache, role: 'owner' };
    },
    async write(ops) {
      cache = applyOps(cache, ops);
      persist();
    },
    setRole(role) {
      if (!cache) return;
      cache = { ...cache, role };
      persist();
    },
  };
}
