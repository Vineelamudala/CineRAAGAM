'use client';

import { useId, useMemo, useState } from 'react';
import { SkipForward } from 'lucide-react';
import { searchMovies, type MovieOption } from '@/lib/search/movies';

type Props = {
  catalog: MovieOption[] | null; // null while loading
  message: string;
  busy: boolean;
  onMessage: (text: string) => void;
  onGuess: (movie: MovieOption) => void;
  onSkip: () => void;
};

/**
 * Movie guess input: an accessible combobox (WAI-ARIA 1.2 list autocomplete).
 * Players must pick a movie from the suggestions; free text is never submitted.
 */
export function GuessForm({ catalog, message, busy, onMessage, onGuess, onSkip }: Props) {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<MovieOption | null>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const listId = useId();
  const optionId = (i: number) => `${listId}-opt-${i}`;

  const results = useMemo(() => (catalog ? searchMovies(query, catalog) : []), [query, catalog]);
  const showList = open && query.trim() !== '' && !selected;

  function choose(movie: MovieOption) {
    setSelected(movie);
    setQuery(movie.title);
    setOpen(false);
    setActive(-1);
  }

  function submit() {
    if (busy) return; // guard against double clicks / double Enter
    if (!selected) {
      onMessage(query.trim() ? 'Pick a movie from the suggestions list.' : 'Enter a movie name or skip this clue.');
      return;
    }
    onGuess(selected);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setOpen(true);
        setActive(i => (results.length ? (i + 1) % results.length : -1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setOpen(true);
        setActive(i => (results.length ? (i <= 0 ? results.length - 1 : i - 1) : -1));
        break;
      case 'Enter':
        e.preventDefault();
        if (showList && active >= 0 && results[active]) choose(results[active]);
        else if (showList && results.length === 1) choose(results[0]);
        else submit();
        break;
      case 'Escape':
        if (showList) { e.preventDefault(); setOpen(false); setActive(-1); }
        break;
    }
  }

  return (
    <div className="guess-section">
      <label htmlFor="movie-guess">WHICH MOVIE IS THIS?</label>
      <div className="guess-row">
        <div className="guess-input-wrap">
          <input
            id="movie-guess"
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={showList}
            aria-controls={listId}
            aria-activedescendant={showList && active >= 0 ? optionId(active) : undefined}
            value={query}
            onChange={e => { setQuery(e.target.value); setSelected(null); setOpen(true); setActive(-1); onMessage(''); }}
            onFocus={() => setOpen(true)}
            onBlur={() => setOpen(false)}
            onKeyDown={onKeyDown}
            placeholder="Type a Telugu movie name..."
            autoComplete="off"
            spellCheck={false}
            disabled={busy}
          />
          <span className="input-hint" aria-hidden="true">↵</span>
          {showList && (
            <div className="suggestions">
              {catalog === null ? (
                <div className="no-match" id={listId}>Loading movie list…</div>
              ) : results.length > 0 ? (
                <ul id={listId} role="listbox" aria-label="Matching movies">
                  {results.map((m, i) => (
                    <li
                      key={m.id}
                      id={optionId(i)}
                      role="option"
                      aria-selected={i === active}
                      onMouseDown={e => e.preventDefault()}
                      onClick={() => choose(m)}
                    >
                      <span>{m.title}</span>
                      {m.year && <small>{m.year}</small>}
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="no-match" id={listId}>No matching movie — check the spelling.</div>
              )}
            </div>
          )}
        </div>
        <button className="submit-button" onClick={submit} disabled={busy}>
          {busy ? 'CHECKING…' : <>SUBMIT GUESS <span aria-hidden="true">↗</span></>}
        </button>
      </div>
      <p className="feedback-message" role="status" aria-live="polite">{message}</p>
      <div className="guess-footer">
        <span><span className="tiny-dot" aria-hidden="true" /> One guess per clue</span>
        <button className="skip-button" onClick={() => { if (!busy) onSkip(); }} disabled={busy}>
          Skip this clue <SkipForward size={14} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
