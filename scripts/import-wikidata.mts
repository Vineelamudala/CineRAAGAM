// Imports the Telugu film catalogue from Wikidata (CC0) into `movies`.
// Safe to re-run: existing movies are never overwritten, so admin edits to
// titles are kept. Hand-entered movies with the same title + year get linked
// to their Wikidata/IMDb ids instead of being duplicated.
//
// Usage (needs .env.local with SUPABASE_SECRET_KEY, or the same env vars set):
//   node scripts/import-wikidata.mts            import
//   node scripts/import-wikidata.mts --dry-run  show what would change
import { createClient } from '@supabase/supabase-js';
import { matchKey, parseBindings, TELUGU_FILMS_QUERY, WIKIDATA_SPARQL_URL, type CatalogRow } from '../lib/catalog/wikidata.ts';

const dryRun = process.argv.includes('--dry-run');
try { process.loadEnvFile('.env.local'); } catch { /* use existing env */ }
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SECRET_KEY.');
  process.exit(1);
}
const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

console.log('Querying Wikidataâ€¦');
const res = await fetch(`${WIKIDATA_SPARQL_URL}?query=${encodeURIComponent(TELUGU_FILMS_QUERY)}&format=json`, {
  headers: {
    Accept: 'application/sparql-results+json',
    // Wikidata asks automated clients to identify themselves.
    'User-Agent': 'CineraagamCatalogImport/0.1 (self-hosted open-source game)',
  },
  signal: AbortSignal.timeout(120_000),
});
if (!res.ok) {
  console.error(`Wikidata request failed: HTTP ${res.status}`);
  process.exit(1);
}
const rows = parseBindings((await res.json()).results.bindings);
console.log(`Wikidata returned ${rows.length} Telugu films.`);

// Load existing movies (paged; the API returns up to 1000 rows per request).
type Existing = { id: string; title: string; release_year: number | null; wikidata_id: string | null; imdb_id: string | null };
const existing: Existing[] = [];
for (let from = 0; ; from += 1000) {
  const { data, error } = await db.from('movies').select('id, title, release_year, wikidata_id, imdb_id').range(from, from + 999);
  if (error) throw error;
  existing.push(...data);
  if (data.length < 1000) break;
}
const byQid = new Set(existing.map(m => m.wikidata_id).filter(Boolean));
const unlinkedByKey = new Map<string, Existing>();
for (const m of existing) {
  if (m.wikidata_id) continue;
  unlinkedByKey.set(matchKey(m.title, m.release_year), m);
  unlinkedByKey.set(matchKey(m.title, null), m);
}

const toInsert: CatalogRow[] = [];
const toLink: { id: string; row: CatalogRow }[] = [];
for (const row of rows) {
  if (byQid.has(row.wikidata_id)) continue;
  const match = unlinkedByKey.get(matchKey(row.title, row.release_year)) ?? unlinkedByKey.get(matchKey(row.title, null));
  if (match) {
    toLink.push({ id: match.id, row });
    unlinkedByKey.delete(matchKey(match.title, match.release_year));
    unlinkedByKey.delete(matchKey(match.title, null));
  } else {
    toInsert.push(row);
  }
}

console.log(`New movies: ${toInsert.length}. Existing movies to link to Wikidata: ${toLink.length}. Already imported: ${rows.length - toInsert.length - toLink.length}.`);
if (dryRun) {
  console.log('Dry run â€” nothing written. Sample:', toInsert.slice(0, 5));
  process.exit(0);
}

for (const { id, row } of toLink) {
  const { error } = await db.from('movies')
    .update({ wikidata_id: row.wikidata_id, imdb_id: row.imdb_id, release_year: row.release_year ?? undefined })
    .eq('id', id);
  if (error) console.warn(`Could not link "${row.title}": ${error.message}`);
}

// IMDb ids must be unique; drop duplicates the database would reject.
const seenImdb = new Set<string>([
  ...existing.map(m => m.imdb_id),
  ...toLink.map(l => l.row.imdb_id),
].filter((v): v is string => !!v));
const clean = toInsert.map(r => {
  if (!r.imdb_id || seenImdb.has(r.imdb_id)) return { ...r, imdb_id: null };
  seenImdb.add(r.imdb_id);
  return r;
});
for (let i = 0; i < clean.length; i += 500) {
  const batch = clean.slice(i, i + 500);
  const { error } = await db.from('movies').upsert(batch, { onConflict: 'wikidata_id', ignoreDuplicates: true });
  if (error) {
    console.error(`Batch ${i / 500 + 1} failed: ${error.message}`);
    process.exit(1);
  }
}
console.log(`Done. Imported ${clean.length} movies.`);
