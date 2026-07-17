// Datapad.jsx — the student game. A small state machine over socket pushes:
// title → how to play → join → (approval) → match (3 rounds, 30 sorts) →
// result. Solo, no pick — every student plays the same class-wide sprint, just
// a different random deal. The server owns all truth; this component only
// renders what it's told.

import { useEffect, useReducer, useRef, useState } from 'react';
import { getSocket, emitAck, errorText } from '../../services/socket.js';
import { Art } from '../../services/assets.jsx';
import SortView from './SortView.jsx';
import ResultScreen from './ResultScreen.jsx';

const initialState = {
  screen: 'title', // title | how | join | waiting_approval | match | result | ended
  joinCode: '',
  name: '',
  studentId: null,
  error: '',
  endedMessage: '',
  match: null,
  matchEnd: null,
};

function freshMatch(begin) {
  return {
    begin,
    roundCard: null,
    turn: null,
    feedback: null,
  };
}

function reducer(state, action) {
  switch (action.type) {
    case 'ui':
      return { ...state, ...action.patch };
    case 'joined':
      return {
        ...state,
        studentId: action.studentId,
        error: '',
        screen: action.approved ? 'match' : 'waiting_approval',
      };
    case 'approved':
      return { ...state, screen: state.screen === 'waiting_approval' ? 'match' : state.screen };
    case 'match:begin':
      return { ...state, screen: 'match', matchEnd: null, match: freshMatch(action.payload) };
    case 'chapter:event': {
      if (!state.match) return state;
      return { ...state, match: { ...state.match, roundCard: action.payload } };
    }
    case 'turn:begin': {
      if (!state.match) return state;
      return { ...state, match: { ...state.match, turn: action.payload } };
    }
    case 'turn:resolution': {
      if (!state.match) return state;
      return { ...state, match: { ...state.match, feedback: action.payload } };
    }
    case 'match:end': {
      // Hold the result until pending feedback is dismissed (chronological order).
      const showNow = !state.match?.feedback;
      return { ...state, matchEnd: action.payload, screen: showNow ? 'result' : state.screen };
    }
    case 'dismiss-feedback': {
      if (!state.match) return state;
      if (state.matchEnd) return { ...state, screen: 'result', match: { ...state.match, feedback: null } };
      return { ...state, match: { ...state.match, feedback: null } };
    }
    case 'dismiss-round':
      return state.match ? { ...state, match: { ...state.match, roundCard: null } } : state;
    case 'sync': {
      const s = action.sync;
      if (s.screen === 'waiting_approval') return { ...state, screen: 'waiting_approval' };
      if (s.screen === 'lobby') return { ...state, screen: 'join' };
      if (s.screen === 'result') return { ...state, screen: 'result', matchEnd: s.matchEnd };
      if (s.screen === 'match') {
        const match = freshMatch(s.matchBegin);
        return {
          ...state,
          screen: 'match',
          matchEnd: null,
          match: { ...match, roundCard: s.chapterEvent, turn: s.turn },
        };
      }
      return state;
    }
    case 'removed':
      return { ...initialState, screen: 'join', joinCode: state.joinCode, name: '', error: 'Your teacher removed you from the session. You can join again.' };
    case 'ended':
      return { ...initialState, screen: 'ended', endedMessage: 'Your teacher ended this session. Great sorting!' };
    case 'play-again':
      return { ...initialState, screen: 'join', joinCode: state.joinCode, name: state.name };
    default:
      return state;
  }
}

export default function Datapad() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    const socket = getSocket();
    const on = (event, type) => {
      const fn = (payload) => dispatch({ type, payload });
      socket.on(event, fn);
      return [event, fn];
    };
    const subs = [
      on('match:begin', 'match:begin'),
      on('chapter:event', 'chapter:event'),
      on('turn:begin', 'turn:begin'),
      on('turn:resolution', 'turn:resolution'),
      on('match:end', 'match:end'),
    ];
    const approved = () => dispatch({ type: 'approved' });
    const removed = () => dispatch({ type: 'removed' });
    const ended = () => dispatch({ type: 'ended' });
    socket.on('join:approved', approved);
    socket.on('student:removed', removed);
    socket.on('session:ended', ended);

    // School wifi blip: the socket reconnects → re-attach and re-sync the screen.
    const onReconnect = async () => {
      const s = stateRef.current;
      if (!s.studentId || !s.joinCode) return;
      const res = await emitAck('student:rejoin', { joinCode: s.joinCode, studentId: s.studentId });
      if (res.ok) dispatch({ type: 'sync', sync: res.sync });
    };
    socket.io.on('reconnect', onReconnect);

    return () => {
      for (const [event, fn] of subs) socket.off(event, fn);
      socket.off('join:approved', approved);
      socket.off('student:removed', removed);
      socket.off('session:ended', ended);
      socket.io.off('reconnect', onReconnect);
    };
  }, []);

  const { screen } = state;
  return (
    <div className="app student-app">
      {screen === 'title' && (
        <TitleScreen
          onStart={() => dispatch({ type: 'ui', patch: { screen: 'join' } })}
          onHow={() => dispatch({ type: 'ui', patch: { screen: 'how' } })}
        />
      )}
      {screen === 'how' && <HowToPlay onBack={() => dispatch({ type: 'ui', patch: { screen: 'title' } })} />}
      {screen === 'join' && <JoinForm state={state} dispatch={dispatch} />}
      {screen === 'waiting_approval' && (
        <WaitCard title="Hold tight!" text="Your teacher is checking names. Your sprint starts in a moment." />
      )}
      {screen === 'match' && state.match && <SortView state={state} dispatch={dispatch} />}
      {screen === 'result' && state.matchEnd && <ResultScreen state={state} dispatch={dispatch} />}
      {screen === 'ended' && (
        <WaitCard title="Session ended" text={state.endedMessage}>
          <button className="btn" onClick={() => dispatch({ type: 'ui', patch: { ...initialState, screen: 'title' } })}>
            Back to the title screen
          </button>
        </WaitCard>
      )}
      <footer className="app-footer">Made for 8th Grade U.S. History · TEKS 8.2B, 8.12A, 8.29B</footer>
    </div>
  );
}

/* ---------------- small screens ---------------- */

function TitleScreen({ onStart, onHow }) {
  return (
    <div className="card title-screen">
      <Art name="title_hero.jpg" alt="A colonial Atlantic coastline at dusk, three glowing regions of shoreline" className="hero-art" />
      <h1 className="game-title">Colony Sort: Region Rush</h1>
      <p className="tagline">Thirty facts. Three buckets. One skill. Five minutes flat.</p>
      <p className="title-blurb">
        A fact card flies in — <b>"founded by William Penn,"</b> <b>"rice and indigo
        plantations,"</b> <b>"cod fishing and shipbuilding."</b> Sort it into
        <b> New England</b>, <b>Middle</b>, or <b>Southern</b> before it lands.
        Three rounds, ten cards each. Wrong answers teach — watch the why.
      </p>
      <div className="btn-col">
        <button className="btn big" onClick={onStart}>Join your class</button>
        <button className="btn secondary" onClick={onHow}>How to play</button>
      </div>
    </div>
  );
}

function HowToPlay({ onBack }) {
  return (
    <div className="card how-screen">
      <h2>How to play</h2>
      <ol className="how-list">
        <li><b>Join with your class code</b> and your first name.</li>
        <li><b>A card flies in.</b> Drag it to a bucket — or tap a bucket, or press 1, 2, or 3.</li>
        <li><b>Three buckets:</b> ⚓ New England · 🌾 Middle · 🌿 Southern.</li>
        <li><b>Three rounds</b> — Founders &amp; Foundings, Economies, Reasons &amp; Society — ten cards each, 30 total.</li>
        <li><b>Miss one?</b> The right bucket glows and a one-line why appears. It's saved for your review at the end.</li>
      </ol>
      <div className="note">
        <b>Winning versus accuracy.</b> The countdown ring and streak flame are just
        for fun. <b>Your grade is accuracy — correct sorts out of 30 — and a slow
        right answer always beats a fast wrong one.</b>
      </div>
      <h3>Words to know</h3>
      <ul className="how-list">
        <li><b>Region</b> — a group of colonies that share geography and ways of life.</li>
        <li><b>Cash crop</b> — grown to sell, not to eat.</li>
        <li><b>Breadbasket</b> — nickname for the grain-growing Middle Colonies.</li>
        <li><b>Toleration</b> — letting people worship differently than you do.</li>
      </ul>
      <button className="btn" onClick={onBack}>Back</button>
    </div>
  );
}

function JoinForm({ state, dispatch }) {
  const [busy, setBusy] = useState(false);
  const set = (patch) => dispatch({ type: 'ui', patch });

  async function join() {
    if (busy) return;
    setBusy(true);
    set({ error: '' });
    const res = await emitAck('student:join', {
      joinCode: state.joinCode.trim(),
      nickname: state.name.trim(),
      mode: 'solo',
      nation: 'class',
    });
    setBusy(false);
    if (!res.ok) return set({ error: errorText(res.error) });
    dispatch({ type: 'joined', studentId: res.studentId, approved: res.approved });
  }

  const ready = state.joinCode.length === 6 && state.name.trim().length >= 2;

  return (
    <div className="card join-screen">
      <h2>Join your class</h2>
      <label htmlFor="join-code">Class code</label>
      <input
        id="join-code" inputMode="numeric" autoComplete="off" maxLength={6}
        placeholder="6-digit code" value={state.joinCode}
        onChange={(e) => set({ joinCode: e.target.value.replace(/\D/g, '') })}
      />
      <label htmlFor="join-name">Your first name</label>
      <input
        id="join-name" maxLength={20} placeholder="e.g. Ana R." value={state.name}
        onChange={(e) => set({ name: e.target.value })}
        onKeyDown={(e) => { if (e.key === 'Enter' && ready && !busy) join(); }}
      />

      <p className="err" role="alert">{state.error}</p>
      <div className="btn-col">
        <button className="btn big" disabled={busy || !ready} onClick={join}>
          {busy ? 'Joining…' : 'Start the rush'}
        </button>
        <button className="btn ghost" onClick={() => set({ screen: 'title', error: '' })}>Back</button>
      </div>
    </div>
  );
}

function WaitCard({ title, text, children }) {
  return (
    <div className="card wait-card">
      <div className="pulse-dot" aria-hidden="true" />
      <h2>{title}</h2>
      <p>{text}</p>
      {children}
    </div>
  );
}
