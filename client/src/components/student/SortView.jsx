// SortView.jsx — one card at a time: round intro (once per round) → a fact
// card flies in with a cosmetic 12s countdown ring → the student drags it to a
// bucket, taps a bucket, or presses 1/2/3 → the server's verdict comes back →
// a brief flash (right) or a 2.5s correction with the correct bucket glowing
// and a one-line why (wrong) → the next card. The ring, streak flame, and
// medal are pure client drama; the server's verdict is the only thing that
// ever reaches the grade (spec §3, §11).
//
// Exactly two cards in the bank carry `serious: true` (enslaved-labor facts).
// On those, the streak flame is suppressed and the why-strip drops the flash
// animation — flat and factual, never arcade (spec §11).

import { useEffect, useRef, useState } from 'react';
import { emitAck, errorText } from '../../services/socket.js';

const BUCKET_STYLE = {
  ne: { className: 'ne', icon: '⚓' },
  mid: { className: 'mid', icon: '🌾' },
  south: { className: 'south', icon: '🌿' },
};

export default function SortView({ state, dispatch }) {
  const { match } = state;
  const { begin, roundCard, turn, feedback } = match;
  const meta = begin.meta || {};
  const buckets = meta.buckets || [];
  const totalActions = meta.totalActions || 30;

  const [streak, setStreak] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  // Synchronous double-click lock. State alone can't stop two clicks landing in
  // the same render frame (both read the stale `submitting === false`), and the
  // second would be graded by the server against the NEXT card. The ref engages
  // immediately; `submitting` still drives the disabled styling.
  const submitLock = useRef(false);
  const [err, setErr] = useState('');
  const seenFeedback = useRef(null);
  const bucketRefs = useRef([]);

  // Count the streak exactly once per resolution (guards React double-renders).
  useEffect(() => {
    if (!feedback) return;
    if (seenFeedback.current === feedback.stepIndex) return;
    seenFeedback.current = feedback.stepIndex;
    setStreak((s) => (feedback.verdict === 'right' ? s + 1 : 0));
    submitLock.current = false;
    setSubmitting(false);
  }, [feedback]);

  // Belt-and-suspenders for the submit lock: a new card arriving (normal flow,
  // or a post-reconnect sync after a lost push) always releases it. Harmless
  // mid-feedback — canAct stays false until the feedback dismisses, and
  // submit() re-checks `canAct` before the lock matters.
  useEffect(() => {
    submitLock.current = false;
    setSubmitting(false);
  }, [turn?.stepIndex]);

  // Auto-advance: a quick pulse on right, a longer 2.5s read on wrong — never a
  // button the student must hunt for; ring expiry never triggers this (spec §3).
  useEffect(() => {
    if (!feedback) return;
    const delay = feedback.verdict === 'right' ? 750 : 2500;
    const t = setTimeout(() => dispatch({ type: 'dismiss-feedback' }), delay);
    return () => clearTimeout(t);
  }, [feedback, dispatch]);

  const canAct = !!turn && !feedback && !roundCard && !submitting;

  async function submit(idx) {
    if (submitLock.current || !canAct) return;
    submitLock.current = true;
    setSubmitting(true);
    setErr('');
    const res = await emitAck('student:submit_move', { move: { kind: 'sort', choiceIndex: idx } });
    // Deliberately NOT unlocked on success: the ack arrives BEFORE the
    // turn:resolution push, and unlocking here would reopen a window where a
    // second tap submits against the NEXT card (server cursor has already
    // advanced). The feedback/turn effects above release the lock.
    if (!res.ok) {
      submitLock.current = false;
      setErr(errorText(res.error));
      setSubmitting(false);
    }
  }

  // Keyboard 1 / 2 / 3 — always available while a card is live (spec §6).
  useEffect(() => {
    function onKey(e) {
      if (!canAct) return;
      if (e.key === '1' || e.key === '2' || e.key === '3') submit(Number(e.key) - 1);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canAct]);

  // The engine batches the next round's card+turn together with this round's
  // LAST turn:resolution — turn/roundCard have both already raced ahead by
  // the time this feedback renders. Pin the header to the last round seen
  // before feedback started so it doesn't read "Round 2" over a Round 1
  // verdict.
  const settledRoundRef = useRef(null);
  if (!feedback) settledRoundRef.current = turn?.round || roundCard?.round || settledRoundRef.current;
  const headerRound = feedback ? (settledRoundRef.current || turn?.round || roundCard?.round) : (turn?.round || roundCard?.round);
  const chosenIndex = feedback ? buckets.findIndex((b) => b.key === feedback.chosenKey) : -1;
  const correctIndex = feedback ? feedback.correctIndex : -1;
  const hideFlame = feedback?.serious;

  return (
    <div className="sort-match">
      <header className="sort-header">
        {headerRound && (
          <div className="round-chip">
            Round {headerRound.index + 1} of {headerRound.count} · {headerRound.title}
          </div>
        )}
        {turn && (
          <div className="progress-chip">{turn.cardInRound}/{turn.cardsPerRound}</div>
        )}
        {streak >= 2 && !hideFlame && <StreakFlame count={streak} />}
      </header>

      <div className="sort-stage">
        {feedback ? (
          <FeedbackStrip feedback={feedback} />
        ) : roundCard ? (
          <RoundIntro roundCard={roundCard} onGo={() => dispatch({ type: 'dismiss-round' })} />
        ) : turn ? (
          <SortCard key={turn.stepIndex} turn={turn} bucketRefs={bucketRefs} onSubmit={submit} busy={submitting} />
        ) : (
          <div className="waiting-panel"><div className="pulse-dot" aria-hidden="true" /><p>Steady…</p></div>
        )}
      </div>

      <p className="err" role="alert">{err}</p>

      <BucketsRow
        buckets={buckets}
        bucketRefs={bucketRefs}
        mode={feedback ? 'feedback' : 'active'}
        disabled={!canAct}
        chosenIndex={chosenIndex}
        correctIndex={correctIndex}
        onPick={submit}
      />

      <p className="progress-total muted">Card {(turn?.stepIndex ?? feedback?.stepIndex ?? -1) + 1} of {totalActions}</p>
    </div>
  );
}

/* -------- round intro (once per round; blocks until GO) -------- */

function RoundIntro({ roundCard, onGo }) {
  const r = roundCard.round;
  return (
    <div className="round-intro-card">
      <div className="event-kicker">Round {r.index + 1} of {r.count}</div>
      <h2>{r.title}</h2>
      <p className="round-vocab">📖 {r.vocab}</p>
      <button className="btn big" onClick={onGo}>GO</button>
    </div>
  );
}

/* -------- the flying card: drag (pointer events), tap-bucket, keyboard -------- */

function SortCard({ turn, bucketRefs, onSubmit, busy }) {
  const [drag, setDrag] = useState(null); // { startX, startY, dx, dy }
  const [returning, setReturning] = useState(false);

  function hitTest(x, y) {
    let hit = -1;
    bucketRefs.current.forEach((el, i) => {
      if (!el) return;
      const r = el.getBoundingClientRect();
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) hit = i;
    });
    return hit;
  }

  function onPointerDown(e) {
    if (busy) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    setReturning(false);
    setDrag({ startX: e.clientX, startY: e.clientY, dx: 0, dy: 0 });
  }
  function onPointerMove(e) {
    if (!drag) return;
    setDrag((d) => (d ? { ...d, dx: e.clientX - d.startX, dy: e.clientY - d.startY } : d));
  }
  function endDrag(e) {
    if (!drag) return;
    const hit = hitTest(e.clientX, e.clientY);
    setDrag(null);
    if (hit >= 0) onSubmit(hit);
    else {
      setReturning(true);
      setTimeout(() => setReturning(false), 240);
    }
  }

  const style = drag ? { transform: `translate(${drag.dx}px, ${drag.dy}px)` } : undefined;

  return (
    <div className="sort-card-wrap">
      <CountdownRing seconds={12} />
      <div
        className={`sort-card ${drag ? 'dragging' : ''} ${returning ? 'returning' : ''} ${turn.card.serious ? 'serious' : ''}`}
        style={style}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <p className="sort-card-text">{turn.card.text}</p>
      </div>
      <p className="sort-card-hint muted">Drag the card, tap a bucket, or press 1 / 2 / 3</p>
    </div>
  );
}

function CountdownRing({ seconds = 12 }) {
  const r = 27;
  const circ = 2 * Math.PI * r;
  return (
    <svg className="countdown-ring" viewBox="0 0 60 60" aria-hidden="true" key={seconds}>
      <circle cx="30" cy="30" r={r} className="ring-track" />
      <circle
        cx="30" cy="30" r={r} className="ring-fill"
        style={{ '--circ': circ, animationDuration: `${seconds}s` }}
      />
    </svg>
  );
}

/* -------- the three buckets, pinned bottom; glow the correct one on a miss -------- */

function BucketsRow({ buckets, bucketRefs, mode, disabled, chosenIndex, correctIndex, onPick }) {
  return (
    <div className="buckets-row" role="group" aria-label="Sort into a region">
      {buckets.map((b, i) => {
        const style = BUCKET_STYLE[b.key] || { className: '', icon: '•' };
        const isCorrect = mode === 'feedback' && i === correctIndex;
        const isWrongPick = mode === 'feedback' && i === chosenIndex && chosenIndex !== correctIndex;
        const cls = [
          'bucket', style.className,
          isCorrect ? 'glow-correct' : '',
          isWrongPick ? 'glow-wrong' : '',
        ].filter(Boolean).join(' ');
        return (
          <button
            key={b.key}
            ref={(el) => { bucketRefs.current[i] = el; }}
            type="button"
            className={cls}
            disabled={disabled}
            onClick={() => onPick(i)}
            aria-label={`${b.label} — press ${i + 1}`}
          >
            <span className="bucket-icon" aria-hidden="true">{style.icon}</span>
            <span className="bucket-label">{b.label}</span>
            <span className="bucket-key muted">{i + 1}</span>
          </button>
        );
      })}
    </div>
  );
}

/* -------- verdict + why, in place of the card (spec §3: 2.5s, then next) -------- */

function FeedbackStrip({ feedback }) {
  const right = feedback.verdict === 'right';
  return (
    <div className={`feedback-strip ${right ? 'right' : 'wrong'} ${feedback.serious ? 'serious' : ''}`}>
      <div className={`verdict-tag ${right ? 'right' : 'wrong'} ${feedback.serious ? '' : 'flash'}`}>
        <span aria-hidden="true">{right ? '✓' : '✗'}</span> {right ? 'Correct!' : 'Not quite'}
      </div>
      <p className="why-text">{feedback.feedback}</p>
    </div>
  );
}

/* -------- streak flame (client-only; never on a serious card) -------- */

function StreakFlame({ count }) {
  const size = count >= 8 ? 'big' : count >= 5 ? 'mid' : 'small';
  return (
    <div className={`streak-flame ${size}`} title={`${count} in a row`}>
      <span aria-hidden="true">🔥</span> {count}
    </div>
  );
}
