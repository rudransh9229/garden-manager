import { coalesce } from './sync.js';

/**
 * Saves changes to the backend one batch at a time, in order, and never drops one.
 * If a save fails (no signal, the service is down) the changes stay queued and are retried
 * after a growing pause, or straight away when asked. Status: 'saved' | 'saving' | 'error'.
 */
export function createWriteQueue({ write, onStatus, delays = [2000, 5000, 15000, 30000] }) {
  let pending = [];
  let running = false;
  let timer = null;
  let attempt = 0;
  let status = 'saved';
  let waiters = [];

  const setStatus = (s, extra) => {
    status = s;
    if (onStatus) onStatus(s, extra || {});
    if (s === 'saved') waiters.splice(0).forEach((resolve) => resolve());
  };

  async function flush() {
    if (running) return;
    clearTimeout(timer);
    timer = null;
    if (!pending.length) {
      if (status !== 'saved') setStatus('saved');
      return;
    }
    running = true;
    setStatus('saving');
    while (pending.length) {
      const batch = coalesce(pending);
      pending = [];
      try {
        await write(batch);
        attempt = 0;
      } catch (e) {
        pending = coalesce([...batch, ...pending]); // older changes first, so newer ones still win
        running = false;
        attempt += 1;
        setStatus('error', { message: String((e && e.message) || e) });
        timer = setTimeout(flush, delays[Math.min(attempt - 1, delays.length - 1)]);
        return;
      }
    }
    running = false;
    setStatus('saved');
  }

  return {
    push(ops) {
      if (!ops.length) return;
      pending.push(...ops);
      flush();
    },
    retry() {
      attempt = 0;
      flush();
    },
    get status() { return status; },
    get waiting() { return pending.length; },
    /** Resolves when everything pushed so far has been saved. */
    idle() { return status === 'saved' ? Promise.resolve() : new Promise((resolve) => waiters.push(resolve)); },
  };
}
