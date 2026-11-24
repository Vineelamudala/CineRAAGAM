'use client';

import { useMemo, useState } from 'react';
import {
  AudioLines, CalendarDays, ChartNoAxesCombined, Check, ChevronDown, CircleHelp,
  Clock3, Flame, Headphones, Home, ListMusic, Menu, Music2, Play, RotateCcw,
  Share2, SkipForward, Sparkles, Trophy, UserRound, Volume2, X
} from 'lucide-react';

type Tab = 'Today' | 'Time Travel' | 'Leaderboard' | 'Statistics' | 'How to Play';
const suggestions = ['Baahubali: The Beginning', 'Ala Vaikunthapurramuloo', 'Jersey', 'RRR', 'Hi Nanna'];
const nav: { label: Tab; icon: typeof Home }[] = [
  { label: 'Today', icon: Home }, { label: 'Time Travel', icon: CalendarDays },
  { label: 'Leaderboard', icon: Trophy }, { label: 'Statistics', icon: ChartNoAxesCombined },
  { label: 'How to Play', icon: CircleHelp }
];

export default function HomePage() {
  const [tab, setTab] = useState<Tab>('Today');
  const [clip, setClip] = useState(1);
  const [guess, setGuess] = useState('');
  const [message, setMessage] = useState('');
  const [finished, setFinished] = useState(false);
  const [won, setWon] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [difficulty, setDifficulty] = useState('Medium');
  const [menuOpen, setMenuOpen] = useState(false);
  const [name, setName] = useState('');
  const [nameSaved, setNameSaved] = useState(false);
  const [showName, setShowName] = useState(true);

  const filtered = useMemo(() => suggestions.filter(s => s.toLowerCase().includes(guess.toLowerCase())), [guess]);
  const countdown = '08:42:15'; // Replace with a midnight IST countdown when daily puzzles are connected.

  function submitGuess() {
    if (!guess.trim()) { setMessage('Enter a movie name or skip this clue.'); return; }
    // Demo behaviour: the sample answer is intentionally not exposed in the UI.
    const correct = guess.trim().toLowerCase() === 'jersey';
    if (correct) { setWon(true); setFinished(true); setPlaying(false); setMessage('That’s correct! You recognised the movie.'); return; }
    advance('Not quite. The next music clue is ready.');
  }
  function advance(text: string) {
    setPlaying(false); setGuess(''); setShowSuggestions(false); setMessage(text);
    if (clip < 3) setClip(c => c + 1);
    else { setFinished(true); setMessage('Challenge complete. Here is today’s movie reveal.'); }
  }
  function resetDemo() { setClip(1); setGuess(''); setMessage(''); setFinished(false); setWon(false); setPlaying(false); }

  return (
    <main className="app-shell">
      <aside className={`sidebar ${menuOpen ? 'sidebar-open' : ''}`}>
        <div className="brand-lockup"><div className="brand-mark"><AudioLines size={22}/></div><div><div className="brand-name">cine<span>raagam</span></div><div className="brand-tag">TELUGU MUSIC, DAILY</div></div><button className="mobile-close icon-button" onClick={() => setMenuOpen(false)} aria-label="Close menu"><X size={19}/></button></div>
        <div className="side-label">PLAY</div>
        <nav className="nav-list">{nav.map(({label, icon: Icon}) => <button key={label} onClick={() => {setTab(label);setMenuOpen(false);}} className={`nav-item ${tab === label ? 'active' : ''}`}><Icon size={18}/><span>{label}</span>{label === 'Today' && <i className="live-dot"/>}</button>)}</nav>
        <div className="sidebar-bottom"><div className="streak-card"><div className="streak-top"><span className="streak-icon"><Flame size={17}/></span><span>YOUR STREAK</span></div><div className="streak-number">07 <small>days</small></div><div className="streak-note">Keep the rhythm going.</div><div className="streak-days">{['M','T','W','T','F','S','S'].map((d,i)=><span key={i} className={i<5?'done':''}>{i<5?<Check size={12}/>:d}</span>)}</div></div><div className="profile-row"><div className="avatar"><UserRound size={17}/></div><div className="profile-copy"><strong>{nameSaved && name ? name : 'Guest Player'}</strong><span>Anonymous player</span></div><span className="online-dot"/></div></div>
      </aside>

      <section className="main-area">
        <header className="topbar"><button className="mobile-menu icon-button" onClick={() => setMenuOpen(true)} aria-label="Open menu"><Menu size={21}/></button><div className="breadcrumb">PLAY <span>/</span> <strong>{tab.toUpperCase()}</strong></div><div className="top-actions"><div className="top-streak"><Flame size={16}/><strong>7</strong><span>day streak</span></div><button className="icon-button" aria-label="Profile" onClick={() => setShowName(true)}><UserRound size={19}/></button></div></header>

        {tab === 'Today' && <>
          <section className="welcome-row"><div><div className="eyebrow"><span className="eyebrow-line"/> THE DAILY TELUGU MUSIC CHALLENGE</div><h1>Hear it. <em>Feel it.</em><br/>Name that movie.</h1><p className="welcome-copy">Three music clues. One Telugu movie. How well do you know your cinema?</p></div><div className="countdown-card"><div className="countdown-label"><Clock3 size={14}/> NEXT CHALLENGE IN</div><div className="countdown-time">{countdown}</div><div className="countdown-foot">A new movie, every day <Sparkles size={13}/></div></div></section>

          <div className="game-layout">
            <section className="game-card">
              <div className="game-card-head"><div><div className="challenge-label">TODAY’S CHALLENGE <span>•</span> #024</div><h2>The mystery soundtrack</h2></div><div className="difficulty-wrap"><span>DIFFICULTY</span><select value={difficulty} onChange={e=>setDifficulty(e.target.value)} aria-label="Difficulty"><option>Easy</option><option>Medium</option><option>Hard</option></select><ChevronDown size={13}/></div></div>
              <div className="clip-progress">{[1,2,3].map(n=><div key={n} className={`clip-step ${n===clip?'current':n<clip?'passed':''}`}><span className="step-number">{n<clip?<Check size={13}/>:`0${n}`}</span><span className="step-title">CLUE {n}</span><span className="step-line"/></div>)}</div>
              {!finished ? <>
                <div className="audio-panel"><div className="audio-panel-top"><div className="audio-kicker"><span className="sound-pulse"/> NOW PLAYING · CLUE 0{clip}</div><span className="clip-duration">0:08</span></div><div className="audio-art"><div className="art-glow glow-one"/><div className="art-glow glow-two"/><div className="vinyl"><div className="vinyl-inner"><Music2 size={25}/></div></div><div className="waveform" aria-label="Audio waveform">{Array.from({length:57},(_,i)=><i key={i} style={{height:`${14+((i*19+7)%54)}%`,opacity:0.35+((i%5)*0.13)}}/>)}</div><div className="art-caption">A SOUND FROM THE SILVER SCREEN</div></div><div className="player-controls"><button className={`play-button ${playing?'is-playing':''}`} onClick={()=>setPlaying(!playing)} aria-label={playing?'Pause audio':'Play audio'}>{playing?<span className="pause-bars"><i/><i/></span>:<Play size={20} fill="currentColor"/>}</button><div className="player-track"><div className="track-meta"><span>{playing?'Playing preview':'Ready when you are'}</span><span>00:00 / 00:08</span></div><div className="track-rail"><i className={playing?'progress-playing':''}/></div></div><button className="replay-button" onClick={()=>setPlaying(true)}><RotateCcw size={15}/><span>Replay</span></button><Volume2 size={17} className="volume-icon"/></div><div className="audio-note"><Headphones size={14}/> Headphones recommended for the full experience.</div></div>
                <div className="guess-section"><label htmlFor="movie-guess">WHICH MOVIE IS THIS?</label><div className="guess-row"><div className="guess-input-wrap"><input id="movie-guess" value={guess} onChange={e=>{setGuess(e.target.value);setShowSuggestions(true);setMessage('');}} onFocus={()=>setShowSuggestions(true)} onKeyDown={e=>e.key==='Enter'&&submitGuess()} placeholder="Type a Telugu movie name..." autoComplete="off"/><span className="input-hint">↵</span>{showSuggestions&&guess&&filtered.length>0&&<div className="suggestions">{filtered.map(s=><button key={s} onClick={()=>{setGuess(s);setShowSuggestions(false);}}>{s}</button>)}</div>}</div><button className="submit-button" onClick={submitGuess}>SUBMIT GUESS <span>↗</span></button></div>{message&&<p className="feedback-message">{message}</p>}<div className="guess-footer"><span><span className="tiny-dot"/> One guess per clue</span><button className="skip-button" onClick={()=>advance('Clue skipped. Listen to the next one.')}>Skip this clue <SkipForward size={14}/></button></div></div>
              </> : <div className="reveal-panel"><div className="reveal-icon"><Trophy size={27}/></div><div className="reveal-eyebrow">{won?'YOU GOT IT!':'TODAY’S MOVIE REVEAL'}</div><h2>Jersey</h2><p className="reveal-cast">Starring Nani · Shraddha Srinath · Sathyaraj</p><div className="result-score"><div><strong>{won?clip===1?100:clip===2?70:40:0}</strong><span>POINTS</span></div><div><strong>{clip}</strong><span>CLIPS USED</span></div><div><strong>{won?'WIN':'PLAYED'}</strong><span>RESULT</span></div></div><button className="share-button" onClick={()=>{if(navigator.share)navigator.share({title:'Cineraagam daily challenge',text:`I played today's Cineraagam challenge! ${won?'Got it':'Challenge completed'} in ${clip} clip(s). Can you beat me?`}).catch(()=>{});else if(navigator.clipboard)navigator.clipboard.writeText(`Cineraagam #024 — ${won?'Solved':'Played'} in ${clip} clip(s). Can you beat me?`);}}><Share2 size={16}/> SHARE RESULT</button><button className="text-button" onClick={resetDemo}>Replay demo <RotateCcw size={13}/></button></div>}
              <div className="game-footnote"><span><span className="lock-dot"/> Your answer stays private until you share.</span><span>POWERED BY YOUR LOVE FOR TELUGU CINEMA</span></div>
            </section>
            <aside className="right-rail"><div className="rail-card mini-stats"><div className="rail-title">YOUR SNAPSHOT <span>↗</span></div><div className="mini-stat"><div className="mini-stat-icon purple"><Flame size={17}/></div><div><strong>07 days</strong><span>Current streak</span></div></div><div className="mini-stat"><div className="mini-stat-icon gold"><Trophy size={17}/></div><div><strong>#128</strong><span>Leaderboard rank</span></div></div><div className="mini-stat"><div className="mini-stat-icon blue"><ChartNoAxesCombined size={17}/></div><div><strong>82%</strong><span>Win rate</span></div></div><button className="rail-link" onClick={()=>setTab('Statistics')}>View all statistics <span>→</span></button></div><div className="rail-card week-card"><div className="rail-title">THE WEEK AHEAD <CalendarDays size={15}/></div><div className="week-days">{['M','T','W','T','F','S','S'].map((d,i)=><div key={i} className={i===2?'today':''}><span>{d}</span><i>{i<2?<Check size={12}/>:i===2?'•':'·'}</i></div>)}</div><p>One new soundtrack every day. Keep your streak alive.</p></div><div className="quote-card"><div className="quote-mark">“</div><p>Some tunes don't just play. They take you back.</p><span>THE CINERAAGAM FEELING</span><div className="quote-decoration"><AudioLines size={65}/></div></div></aside>
          </div>
          <section className="bottom-strip"><div className="bottom-strip-title"><ListMusic size={16}/> MORE WAYS TO PLAY</div><button onClick={()=>setTab('Time Travel')}><CalendarDays size={17}/><span><strong>Time Travel</strong><small>Revisit past challenges</small></span><b>→</b></button><button onClick={()=>setTab('Leaderboard')}><Trophy size={17}/><span><strong>Leaderboard</strong><small>See how you rank</small></span><b>→</b></button><button onClick={()=>setTab('How to Play')}><CircleHelp size={17}/><span><strong>How to play</strong><small>Learn the rules</small></span><b>→</b></button></section>
        </>}
        {tab !== 'Today' && <section className="placeholder-page"><div className="eyebrow"><span className="eyebrow-line"/> CINERAAGAM</div><h1>{tab === 'Time Travel'?'The soundtrack archive':tab === 'Leaderboard'?'The leaderboard':tab === 'Statistics'?'Your journey in music':'How to play'}</h1><p className="welcome-copy">{tab === 'Time Travel'?'Revisit previous daily challenges and see if you can recognise the music now.':tab === 'Leaderboard'?'See how your fellow Telugu cinema fans are doing.':tab === 'Statistics'?'Every guess, every streak, every movie recognised.': 'Three clips. Three chances. One movie to identify.'}</p>{tab==='How to Play'?<div className="rules-grid">{[['01','Listen to clue one','A short BGM or song interlude from a Telugu movie.'],['02','Make one guess','Type the movie name. You get one guess for each clip.'],['03','Skip or try again','A wrong answer or skip unlocks the next different clip.'],['04','Reveal and share','After clue three, the movie name and cast are revealed.']].map(([n,t,d])=><div className="rule-card" key={n}><span>{n}</span><h3>{t}</h3><p>{d}</p></div>)}</div>:<div className="empty-state"><div className="empty-icon">{tab==='Time Travel'?<CalendarDays/>:tab==='Leaderboard'?<Trophy/>:<ChartNoAxesCombined/>}</div><h3>{tab==='Time Travel'?'Your past challenges will appear here':tab==='Leaderboard'?'The rankings are warming up':'Your stats will build as you play'}</h3><p>This section will be connected when we add the database and real daily challenges.</p><button className="submit-button" onClick={()=>setTab('Today')}>BACK TO TODAY <span>↗</span></button></div>}</section>}
        <footer className="footer"><span>© 2026 CINERAAGAM</span><span>MADE FOR THE LOVE OF TELUGU CINEMA <span className="footer-heart">♥</span></span></footer>
      </section>

      {showName && !nameSaved && <div className="modal-backdrop"><div className="name-modal"><button className="modal-close" onClick={()=>setShowName(false)} aria-label="Close"><X size={17}/></button><div className="brand-mark modal-mark"><AudioLines size={22}/></div><div className="eyebrow centered">WELCOME TO CINERAAGAM</div><h2>What should we<br/><em>call you?</em></h2><p>Choose a display name for your player profile and leaderboard.</p><input value={name} maxLength={20} onChange={e=>setName(e.target.value)} placeholder="Your name" onKeyDown={e=>e.key==='Enter'&&name.trim()&&(setNameSaved(true),setShowName(false))}/><button className="submit-button modal-submit" disabled={!name.trim()} onClick={()=>{setNameSaved(true);setShowName(false);}}>LET’S PLAY <span>↗</span></button><small>No email. No password. Just your name.</small><button className="skip-name" onClick={()=>setShowName(false)}>Maybe later</button></div></div>}
    </main>
  );
}
