// gamemanager.test.js — drives the manager exactly the way socketHandlers does
// and inspects the emit instructions it returns. No sockets involved. Colony
// Sort is a solo knowledge sprint with no pick and no AI rival, so these focus
// on the solo lifecycle, the single class-wide group, the round-intro pushes,
// and the "still scores /30, verdict-only" promise.
import test from 'node:test';
import assert from 'node:assert/strict';
import { GameManager } from '../src/GameManager.js';
import game, { TOTAL_ACTIONS } from '../src/games/usColonySort.js';

const PIN = '4242';

function makeSession(manager, { requireApproval = false } = {}) {
  const res = manager.createSession({ pin: PIN, requireApproval });
  assert.ok(res.joinCode, 'session created');
  return res.joinCode;
}

function join(manager, joinCode, nickname) {
  const res = manager.joinStudent({ joinCode, nickname, mode: 'solo', nation: 'class' });
  assert.ok(!res.error, `join failed: ${res.error}`);
  return res;
}

const studentEvents = (emits, studentId, name) =>
  emits.filter((e) => e.to.type === 'student' && e.to.studentId === studentId && (!name || e.event === name));
const eventsOf = (emits, name) => emits.filter((e) => e.event === name);

function liveMatch(manager, joinCode, studentId) {
  const session = manager.registry.get(joinCode);
  const student = session.students.get(studentId);
  return session.matches.get(student.matchId);
}

// Sort the current card into its historically correct bucket.
function sortRight(manager, joinCode, studentId) {
  const match = liveMatch(manager, joinCode, studentId);
  const move = game.aiMove(match.gameState, match.side);
  return manager.submitMove({ joinCode, studentId, move });
}

function sortAllRight(manager, joinCode, studentId) {
  let last;
  for (let i = 0; i < TOTAL_ACTIONS; i++) {
    last = sortRight(manager, joinCode, studentId);
    assert.ok(!last.error, `step ${i}: ${last.error}`);
  }
  return last;
}

test('createSession rejects a bad PIN', () => {
  const manager = new GameManager();
  assert.equal(manager.createSession({ pin: 'abc' }).error, 'bad_pin');
  assert.equal(manager.createSession({ pin: '12345' }).error, 'bad_pin');
});

test('the default game is Colony Sort', () => {
  const manager = new GameManager();
  const joinCode = makeSession(manager);
  assert.equal(manager.registry.get(joinCode).gameId, 'us-colony-sort');
});

test('teacher ops require the right PIN', () => {
  const manager = new GameManager();
  const joinCode = makeSession(manager);
  assert.equal(manager.endSession({ joinCode, pin: '9999' }).error, 'bad_pin');
  assert.equal(manager.setApproval({ joinCode, pin: '0000', requireApproval: false }).error, 'bad_pin');
});

test('a student starts the sprint on join, gets the Round 1 intro and the first card', () => {
  const manager = new GameManager();
  const joinCode = makeSession(manager);
  const res = join(manager, joinCode, 'Ana');

  const begin = studentEvents(res.emits, res.studentId, 'match:begin');
  assert.equal(begin.length, 1, 'solo match begins on join — no draw, no pairing');
  assert.equal(begin[0].payload.side, 'class');
  assert.equal(begin[0].payload.chapterCount, 3, 'three rounds');
  assert.equal(begin[0].payload.rivalMeters, null, 'a solo sprint has no rival');
  assert.ok(begin[0].payload.meta.buckets.length === 3, 'the three buckets ship in meta');

  const intro = studentEvents(res.emits, res.studentId, 'chapter:event');
  assert.equal(intro.length, 1, 'the Round 1 intro is pushed on start');
  assert.equal(intro[0].payload.round.index, 0);

  const turn = studentEvents(res.emits, res.studentId, 'turn:begin')[0].payload;
  assert.equal(turn.kind, 'sort');
  assert.ok(turn.card.text.length > 3, 'the first card text is present');
  assert.equal(turn.buckets.length, 3);
});

test('playing all 30 right earns 100% and a Gold medal, with an empty miss list', () => {
  const manager = new GameManager();
  const joinCode = makeSession(manager);
  const res = join(manager, joinCode, 'Ana');

  const last = sortAllRight(manager, joinCode, res.studentId);
  const end = studentEvents(last.emits, res.studentId, 'match:end');
  assert.equal(end.length, 1, 'match ends after 30 sorts');
  assert.equal(end[0].payload.you.accuracy, 100);
  assert.equal(end[0].payload.you.medal.key, 'gold');
  assert.equal(end[0].payload.you.misses.length, 0);
  assert.deepEqual(end[0].payload.you.rounds.map((r) => r.correct), [10, 10, 10]);

  const roster = manager.roster(manager.registry.get(joinCode));
  assert.equal(roster.students[0].status, 'completed');
  assert.equal(roster.students[0].accuracy, 100);
});

test('the Round 2 and Round 3 intros arrive at the round boundaries (after the 10th and 20th sort)', () => {
  const manager = new GameManager();
  const joinCode = makeSession(manager);
  const res = join(manager, joinCode, 'Ana');
  const sid = res.studentId;

  const introRounds = [];
  for (let i = 0; i < TOTAL_ACTIONS; i++) {
    const r = sortRight(manager, joinCode, sid);
    for (const e of studentEvents(r.emits, sid, 'chapter:event')) introRounds.push(e.payload.round.index);
  }
  // Rounds 2 and 3 appear as the student crosses into them (Round 1 arrived on join).
  assert.deepEqual(introRounds, [1, 2], 'exactly the Round 2 and Round 3 intros, in order');
});

test('a wrong sort is graded 0 and rides its why-line to the client', () => {
  const manager = new GameManager();
  const joinCode = makeSession(manager);
  const res = join(manager, joinCode, 'Bea');
  const sid = res.studentId;

  const match = liveMatch(manager, joinCode, sid);
  const card = match.gameState.sides.class.deck[0].card;
  const correctIdx = game.aiMove(match.gameState, match.side).choiceIndex;
  const wrongIdx = (correctIdx + 1) % 3;

  const r = manager.submitMove({ joinCode, studentId: sid, move: { kind: 'sort', choiceIndex: wrongIdx } });
  const resolution = studentEvents(r.emits, sid, 'turn:resolution')[0].payload;
  assert.equal(resolution.verdict, 'wrong');
  assert.equal(resolution.correctIndex, correctIdx, 'the client is told which bucket should glow');
  assert.equal(resolution.feedback, card.why, 'the why-line teaches the miss');
});

test('class accuracy is a single class-wide group', () => {
  const manager = new GameManager();
  const joinCode = makeSession(manager);
  const a = join(manager, joinCode, 'Ana');
  const b = join(manager, joinCode, 'Ben');
  for (const s of [a, b]) sortAllRight(manager, joinCode, s.studentId);

  const roster = manager.roster(manager.registry.get(joinCode));
  assert.equal(roster.classAccuracy.class.count, 2, 'both students in the one class group');
  assert.equal(roster.classAccuracy.class.average, 100);
});

test('approval gate: a solo student waits, then starts the sprint on approve', () => {
  const manager = new GameManager();
  const joinCode = makeSession(manager, { requireApproval: true });
  const res = join(manager, joinCode, 'Mara');
  assert.equal(res.approved, false);
  assert.equal(studentEvents(res.emits, res.studentId, 'match:begin').length, 0);

  const ok = manager.approveStudent({ joinCode, pin: PIN, studentId: res.studentId });
  assert.equal(studentEvents(ok.emits, res.studentId, 'join:approved').length, 1);
  assert.equal(studentEvents(ok.emits, res.studentId, 'match:begin').length, 1);
});

test('a wrong-kind move is rejected (every step is a sort)', () => {
  const manager = new GameManager();
  const joinCode = makeSession(manager);
  const res = join(manager, joinCode, 'Ana');
  const bad = manager.submitMove({ joinCode, studentId: res.studentId, move: { kind: 'decision', choiceIndex: 0 } });
  assert.equal(bad.error, 'wrong_step_kind');
});

test('rejoin returns a full snapshot of the live sort card', () => {
  const manager = new GameManager();
  const joinCode = makeSession(manager);
  const res = join(manager, joinCode, 'Ana');
  sortRight(manager, joinCode, res.studentId); // one sort done; another pending

  manager.markDisconnected({ joinCode, studentId: res.studentId });
  const back = manager.rejoinStudent({ joinCode, studentId: res.studentId });
  assert.ok(!back.error);
  assert.equal(back.sync.screen, 'match');
  assert.equal(back.sync.turn.kind, 'sort');
  assert.ok(back.sync.turn.card.text.length > 3);
  assert.equal(back.sync.turn.buckets.length, 3);
});

test('end_session wipes the session from memory', () => {
  const manager = new GameManager();
  const joinCode = makeSession(manager);
  join(manager, joinCode, 'Ana');
  const res = manager.endSession({ joinCode, pin: PIN });
  assert.ok(eventsOf(res.emits, 'session:ended').length >= 2, 'teacher + student notified');
  assert.equal(manager.registry.get(joinCode), undefined);
});

test('students cannot reach teacher data: report requires the PIN', () => {
  const manager = new GameManager();
  const joinCode = makeSession(manager);
  assert.equal(manager.sessionReport({ joinCode, pin: '1111' }).error, 'bad_pin');
  assert.ok(manager.sessionReport({ joinCode, pin: PIN }).report);
});
