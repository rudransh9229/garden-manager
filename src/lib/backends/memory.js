import { applyOps, emptyData } from '../sync.js';

/**
 * A pretend online database that lives in memory. Used by the checks to prove that two devices
 * stay in step and that failed saves are retried. It follows the same contract a real backend must:
 *   load()            -> { state, role }
 *   write(ops)        -> saves a batch, throws if it cannot
 *   subscribe(onOps)  -> calls onOps with writes made by OTHER devices; returns a function that stops it
 */
export function createMemoryServer(initial = emptyData()) {
  let data = JSON.parse(JSON.stringify(initial));
  const connections = new Set();
  return {
    get data() { return data; },
    connect({ role = 'owner' } = {}) {
      const me = { failures: 0, listeners: new Set() };
      connections.add(me);
      return {
        name: 'memory',
        async load() { return { state: JSON.parse(JSON.stringify(data)), role }; },
        async write(ops) {
          if (me.failures > 0) { me.failures -= 1; throw new Error('offline'); }
          const wire = JSON.parse(JSON.stringify(ops)); // what travels is a copy, never shared objects
          data = applyOps(data, wire);
          for (const other of connections) if (other !== me) other.listeners.forEach((fn) => fn(wire));
        },
        subscribe(fn) { me.listeners.add(fn); return () => me.listeners.delete(fn); },
        failNext(n) { me.failures = n; },
      };
    },
  };
}
