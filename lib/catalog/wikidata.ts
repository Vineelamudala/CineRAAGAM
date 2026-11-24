/**
 * Telugu film catalogue from Wikidata (CC0 licensed, free to reuse).
 * Self-contained (no app imports) so the Node import script can use it directly.
 */

export const WIKIDATA_SPARQL_URL = 'https://query.wikidata.org/sparql';

/** Films (Q11424) whose original language (P364) is Telugu (Q8097), with an English label. */
export const TELUGU_FILMS_QUERY = `
SELECT ?film (SAMPLE(?label) AS ?title) (MIN(YEAR(?date)) AS ?year) (SAMPLE(?imdb) AS ?imdbId) WHERE {
  ?film wdt:P31 wd:Q11424 ;
        wdt:P364 wd:Q8097 ;
        rdfs:label ?label .
  FILTER(LANG(?label) = "en")
  OPTIONAL { ?film wdt:P577 ?date }
  OPTIONAL { ?film wdt:P345 ?imdb }
}
GROUP BY ?film`;

export type WikidataBinding = Record<string, { type: string; value: string } | undefined>;

export type CatalogRow = {
  wikidata_id: string;
  title: string;
  release_year: number | null;
  imdb_id: string | null;
};

/** Turn SPARQL JSON bindings into validated rows (drops anything malformed). */
export function parseBindings(bindings: WikidataBinding[]): CatalogRow[] {
  const rows = new Map<string, CatalogRow>();
  for (const b of bindings) {
    const qid = b.film?.value.match(/\/(Q\d+)$/)?.[1];
    const title = b.title?.value.trim().replace(/\s+/g, ' ');
    if (!qid || !title || title.length > 200 || /^Q\d+$/.test(title)) continue;
    const yearNum = b.year ? Number(b.year.value) : NaN;
    const release_year = Number.isInteger(yearNum) && yearNum >= 1930 && yearNum <= 2100 ? yearNum : null;
    const imdb = b.imdbId?.value.trim();
    rows.set(qid, { wikidata_id: qid, title, release_year, imdb_id: imdb && /^tt\d+$/.test(imdb) ? imdb : null });
  }
  return [...rows.values()];
}

/** Key used to match an imported film to an existing hand-entered movie. */
export function matchKey(title: string, year: number | null): string {
  return `${title.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '')}|${year ?? ''}`;
}
