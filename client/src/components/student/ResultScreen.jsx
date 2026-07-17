// ResultScreen.jsx — accuracy first (the score that matters to your teacher),
// then the medal (a cosmetic tier drawn FROM that accuracy, never the other
// way around), the per-round bars, and — the game's real payload — a "Review
// your misses" list naming every card the student got wrong and why. Serious
// (enslaved-labor) misses keep a flat, factual card, never the arcade styling
// the rest of the list uses (spec §11).

import { Art } from '../../services/assets.jsx';

const REGION_ICON = { ne: '⚓', mid: '🌾', south: '🌿' };
const MEDAL_ART = { gold: 'medal_gold.svg', silver: 'medal_silver.svg', bronze: 'medal_bronze.svg' };
const MEDAL_ICON = { gold: '🥇', silver: '🥈', bronze: '🥉', none: '📋' };

export default function ResultScreen({ state, dispatch }) {
  const end = state.matchEnd;
  const you = end.you;
  const ending = you.ending;
  const medal = you.medal;

  return (
    <div className="card result-screen">
      <div className="event-kicker">Colony Sort: Region Rush</div>
      <h1 className={`result-headline tier-${medal.key}`}>{ending.title}</h1>

      <div className="medal-block">
        {MEDAL_ART[medal.key] ? (
          <Art name={MEDAL_ART[medal.key]} alt={`${medal.label} medal, an engraved colonial star`} className="medal-art" />
        ) : (
          <div className="medal-icon-fallback" aria-hidden="true">{MEDAL_ICON[medal.key]}</div>
        )}
        <div className="medal-label">{medal.key === 'none' ? 'No medal yet' : `${medal.label} medal`}</div>
      </div>

      <div className="accuracy-block">
        <div className="accuracy-number">{you.accuracy}%</div>
        <div>
          <b>Your accuracy — the score your teacher sees.</b>
          <p>{you.correct} correct out of {you.total} sorts. A slow right answer always beats a fast wrong one.</p>
        </div>
      </div>

      <p className="fall-note">{ending.text}</p>

      <div className="round-bars">
        {you.rounds.map((r) => (
          <div key={r.index} className="round-bar-row">
            <span className="round-bar-label">Round {r.index + 1} · {r.title}</span>
            <span className="round-bar-track">
              <span
                className="round-bar-fill"
                style={{ width: `${r.total ? (r.correct / r.total) * 100 : 0}%` }}
              />
            </span>
            <span className="round-bar-num">{r.correct}/{r.total}</span>
          </div>
        ))}
      </div>

      <div className="miss-review">
        <h3>Review your misses {you.misses.length > 0 && `(${you.misses.length})`}</h3>
        {you.misses.length === 0 ? (
          <p className="muted">No misses — every card landed in the right bucket!</p>
        ) : (
          <ul className="miss-list">
            {you.misses.map((m, i) => (
              <li key={i} className={`miss-item ${m.serious ? 'serious' : ''}`}>
                <div className="miss-text">{m.text}</div>
                <div className="miss-answer">
                  <span className="miss-region-tag">{REGION_ICON[m.region]} {m.regionLabel}</span>
                  <span className="miss-why">{m.why}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="btn-col">
        <button className="btn big" onClick={() => dispatch({ type: 'play-again' })}>
          Play again — a fresh deal is waiting
        </button>
      </div>
    </div>
  );
}
