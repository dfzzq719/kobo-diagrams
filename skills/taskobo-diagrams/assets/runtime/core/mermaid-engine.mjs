// Mermaid has mutable configuration. Every consumer of the same engine instance
// must share this queue, including the enterprise SVG measurement/postprocessing.
const queues = new WeakMap();
let sequence = 0;

function requireEngine(mermaid) {
  if (!mermaid || !['initialize', 'parse', 'render'].every(key => typeof mermaid[key] === 'function')) {
    throw new TypeError('A Mermaid instance with initialize, parse, and render is required.');
  }
  return mermaid;
}

function copyConfig(value, seen = new WeakMap()) {
  if (!value || typeof value !== 'object') return value;
  if (seen.has(value)) return seen.get(value);
  const result = Array.isArray(value) ? [] : {};
  seen.set(value, result);
  for (const key of Object.keys(value)) {
    if (!['__proto__', 'constructor', 'prototype'].includes(key)) result[key] = copyConfig(value[key], seen);
  }
  return result;
}

export function enqueueMermaid(mermaid, operation) {
  requireEngine(mermaid);
  const result = (queues.get(mermaid) || Promise.resolve()).then(operation);
  // A bad source must never block the next document.
  queues.set(mermaid, result.catch(() => {}));
  return result;
}

// Internal entry point for callers already holding the shared queue.
export async function renderWithMermaid(mermaid, source, {config = {}, id, container} = {}) {
  requireEngine(mermaid);
  if (typeof source !== 'string') throw new TypeError('Mermaid source must be a string.');
  await mermaid.initialize({securityLevel: 'strict', ...config, startOnLoad: false});
  await mermaid.parse(source);
  return mermaid.render(id || `kobo_diagram_${++sequence}`, source, container);
}

/** Render ordinary Mermaid without applying enterprise source or style rules. */
export function createMermaidRenderer(mermaid) {
  requireEngine(mermaid);
  return Object.freeze({
    render(source, {config = {}, id, container} = {}) {
      const configuration = copyConfig(config);
      return enqueueMermaid(mermaid, () => renderWithMermaid(mermaid, source, {config: configuration, id, container}));
    },
  });
}
