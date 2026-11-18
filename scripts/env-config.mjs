export function updateEnv(text, defaults, overrides = {}) {
  const seen = new Set();
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter(line => {
    const key = line.match(/^\s*(?:export\s+)?([A-Z_][A-Z0-9_]*)\s*=/)?.[1];
    if (!key) return true;
    if (seen.has(key)) return false;
    seen.add(key); return true;
  }).map(line => {
    const key = line.match(/^\s*(?:export\s+)?([A-Z_][A-Z0-9_]*)\s*=/)?.[1];
    return key && key in overrides ? `${key}=${JSON.stringify(overrides[key])}` : line;
  });
  for (const [key, value] of Object.entries({...defaults, ...overrides})) {
    if (!seen.has(key)) lines.push(`${key}=${JSON.stringify(value)}`);
  }
  return lines.join('\n').trim() + '\n';
}
export const defaults = {DATABASE_URL:'file:../db/custom.db', APP_ORIGIN:'http://127.0.0.1:3000', COOKIE_SECURE:'false', AI_ENABLED:'false'};
