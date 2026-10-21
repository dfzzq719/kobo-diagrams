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
  const limit = Number(mermaid.mermaidAPI?.getConfig?.().maxTextSize ?? config.maxTextSize ?? 50000);
  if (Number.isFinite(limit) && source.length > limit) {
    throw Object.assign(new Error(`图表源码 ${source.length} 字符，超过引擎上限 ${limit}；请拆分图表，完整说明保留在项目资料中。`), {code:'DIAGRAM_TEXT_LIMIT',characters:source.length,limit});
  }
  await mermaid.parse(source);
  const result = await mermaid.render(id || `kobo_diagram_${++sequence}`, source, container);
  const visible = String(result.svg ?? '').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
  if (/<(?:text|path|g)\b[^>]*\bclass=["'][^"']*\berror-(?:icon|text)\b/i.test(result.svg ?? '') ||
      (visible.includes('Maximum text size in diagram exceeded') && !source.includes('Maximum text size in diagram exceeded'))) {
    throw Object.assign(new Error('引擎返回了错误提示图，未生成有效业务图表；请拆分内容并重试。'),{code:'DIAGRAM_ERROR_GRAPHIC'});
  }
  return result;
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
