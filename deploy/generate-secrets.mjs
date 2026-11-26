// Creates deploy/.env with fresh random secrets for a production install.
//   node deploy/generate-secrets.mjs <domain>          e.g. cineraagam.in
//   node deploy/generate-secrets.mjs --local           local test on http://localhost:8080
// Refuses to overwrite an existing deploy/.env (that would lock you out of the database).
import { createHmac, randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const target = join(here, '.env');
const arg = process.argv[2];
if (!arg) {
  console.error('Usage: node deploy/generate-secrets.mjs <domain> | --local');
  process.exit(1);
}
if (existsSync(target) && !process.argv.includes('--force')) {
  console.error(`${target} already exists. Not overwriting (use --force only on a fresh install).`);
  process.exit(1);
}

const b64url = buf => Buffer.from(buf).toString('base64url');
const random = bytes => randomBytes(bytes).toString('base64url');

/** HS256 JWT (the anon / service_role API keys Supabase services understand). */
function jwt(payload, secret) {
  const head = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64url(JSON.stringify(payload));
  const sig = createHmac('sha256', secret).update(`${head}.${body}`).digest('base64url');
  return `${head}.${body}.${sig}`;
}

const jwtSecret = random(48); // 64 chars
const iat = Math.floor(Date.now() / 1000);
const exp = iat + 10 * 365 * 24 * 3600; // keys are rotated by re-running on a new install
const values = {
  POSTGRES_PASSWORD: random(32),
  JWT_SECRET: jwtSecret,
  ANON_KEY: jwt({ role: 'anon', iss: 'supabase', iat, exp }, jwtSecret),
  SERVICE_ROLE_KEY: jwt({ role: 'service_role', iss: 'supabase', iat, exp }, jwtSecret),
};

const local = arg === '--local';
const domain = local ? null : arg.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
if (!local && !/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(domain)) {
  console.error(`"${arg}" doesn't look like a domain name.`);
  process.exit(1);
}
Object.assign(values, local
  ? { PUBLIC_URL: 'http://localhost:8080', SITE_ADDRESS: ':80', HTTP_PORT: '8080', HTTPS_PORT: '8443' }
  : { PUBLIC_URL: `https://${domain}`, SITE_ADDRESS: domain, HTTP_PORT: '80', HTTPS_PORT: '443' });

let text = readFileSync(join(here, '.env.example'), 'utf8');
for (const [key, value] of Object.entries(values)) {
  text = text.replace(new RegExp(`^${key}=.*$`, 'm'), `${key}=${value}`);
}
writeFileSync(target, text, { mode: 0o600 });
console.log(`Wrote ${target} for ${values.PUBLIC_URL}`);
console.log('Keep this file safe and private — back it up somewhere other than the server.');
