import https from 'node:https';
import { lookup } from 'node:dns/promises';

export function isPublicIPv4(ip) {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some(n => !Number.isInteger(n) || n < 0 || n > 255)) return false;
  const [a,b] = parts;
  return !(a === 0 || a === 10 || a === 127 || a >= 224 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && [0,168].includes(b)) || (a === 198 && [18,19,51].includes(b)) || (a === 203 && b === 0));
}
export function checkedUrl(raw) {
  const u = new URL(raw);
  if (u.protocol !== 'https:' || u.username || u.password || (u.port && u.port !== '443') || !u.hostname.includes('.') || /^[\d.]+$/.test(u.hostname) || /[\[\]:]/.test(u.hostname) || /\.(local|internal|localhost|test|invalid)$/.test(u.hostname)) throw new Error('Only public HTTPS source URLs are supported.');
  u.hash = ''; return u;
}
/** IPv4-only by design: validate every answer and pin the connection to the checked address. */
export async function fetchPublic(raw, redirects = 0) {
  if (redirects > 4) throw new Error('Too many source redirects.');
  const url = checkedUrl(raw);
  const answers = await lookup(url.hostname, { family: 4, all: true });
  if (!answers.length || answers.some(a => !isPublicIPv4(a.address))) throw new Error('Source resolves to a restricted address.');
  const response = await new Promise((resolve, reject) => {
    const req = https.get(url, {
      agent: false,
      headers: { 'User-Agent': 'AdhanConnectMosqueAssistant/1.0', Accept: 'text/html,application/pdf,image/png,image/jpeg,image/webp,text/plain', 'Accept-Encoding': 'identity' },
      lookup: (_host, options, cb) => options?.all ? cb(null, [{ address: answers[0].address, family: 4 }]) : cb(null, answers[0].address, 4),
    }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) { res.resume(); resolve({ redirect: new URL(res.headers.location, url).href }); return; }
      if (res.statusCode < 200 || res.statusCode >= 300) { res.resume(); reject(new Error(`Source returned HTTP ${res.statusCode}.`)); return; }
      let size = 0; const chunks = [];
      res.on('data', chunk => { size += chunk.length; if (size > 4 * 1024 * 1024) req.destroy(new Error('Source exceeds the 4 MB limit.')); else chunks.push(chunk); });
      res.on('end', () => resolve({ url: url.href, type: String(res.headers['content-type'] || '').split(';')[0], bytes: Buffer.concat(chunks) }));
      res.on('error', reject);
    });
    const timer = setTimeout(() => req.destroy(new Error('Source request timed out.')), 20000);
    req.on('close', () => clearTimeout(timer)); req.on('error', reject);
  });
  return response.redirect ? fetchPublic(response.redirect, redirects + 1) : response;
}
export function robotsAllows(text, path) {
  // Honor both the named crawler and wildcard groups; ambiguous restrictions fail closed.
  let applies = false; let directives = false; const rules = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, '').trim(); const colon = line.indexOf(':');
    if (colon < 0) continue;
    const name = line.slice(0, colon).trim().toLowerCase(); const value = line.slice(colon + 1).trim();
    if (name === 'user-agent') {
      if (directives) { applies = false; directives = false; }
      applies ||= value === '*' || value.toLowerCase().includes('adhanconnect');
    } else if (name === 'allow' || name === 'disallow') {
      directives = true;
      if (applies && value) {
        const pattern = '^' + value.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\\\$$/, '$');
        if (new RegExp(pattern).test(path)) rules.push({ length: value.length, allow: name === 'allow' });
      }
    }
  }
  rules.sort((a,b) => b.length - a.length || Number(b.allow) - Number(a.allow));
  return rules[0]?.allow ?? true;
}
