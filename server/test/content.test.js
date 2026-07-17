// content.test.js — structure, bank-integrity, deal, and scoring checks on the
// Colony Sort content. The core promise of this game: 36 verified region facts
// in three 12-card pools, dealt 10 per round, sorted into three buckets, graded
// verdict-only. These tests guard the spec's §10 checklist: the four required
// traps are present, every card is bucket-decidable to exactly one region, the
// deal differs between sessions, the timer/streak/medal never touch the grade,
// and the two enslaved-labor cards stay flat and factual (spec §11).
import test from 'node:test';
import assert from 'node:assert/strict';
import game, {
  BANK, ROUNDS, BUCKETS, BUCKET_INDEX, dealSteps,
  medalFor, endingFor, MEDALS, CARDS_PER_ROUND, POOL_PER_ROUND, TOTAL_ACTIONS,
} from '../src/games/usColonySort.js';

const REGIONS = new Set(['ne', 'mid', 'south']);
const DIFFS = new Set(['easy', 'medium', 'tricky']);
const words = (s) => s.trim().split(/\s+/).length;
const allCards = BANK.flat();

// --- shape -----------------------------------------------------------------

test('game surface: solo, no pick, no meters, 30 actions, 3 rounds', () => {
  assert.equal(game.id, 'us-colony-sort');
  assert.deepEqual(game.modes, ['solo']);
  assert.deepEqual(game.sides, ['class'], 'one class-wide group, no pick');
  assert.equal(game.soloRival, false, 'a pure knowledge sprint, no AI rival');
  assert.equal(game.totalActions, 30);
  assert.equal(game.chapterCount, 3);
  assert.deepEqual(game.meta.meters, {}, 'no meters');
  assert.equal(game.meta.buckets.length, 3);
  assert.equal(TOTAL_ACTIONS, 30);
});

test('bank: 3 rounds x 12 cards = 36, with the 4/5/3 difficulty quotas per round', () => {
  assert.equal(BANK.length, 3);
  assert.equal(allCards.length, 36);
  for (const [r, pool] of BANK.entries()) {
    assert.equal(pool.length, POOL_PER_ROUND, `round ${r}: 12 cards`);
    const by = { easy: 0, medium: 0, tricky: 0 };
    for (const c of pool) by[c.difficulty]++;
    assert.deepEqual(by, { easy: 4, medium: 5, tricky: 3 }, `round ${r}: 4 easy / 5 medium / 3 tricky`);
  }
});

test('every card is well-formed and bucket-decidable to exactly one region', () => {
  for (const c of allCards) {
    assert.ok(REGIONS.has(c.region), `region valid: ${c.text}`);
    assert.ok(DIFFS.has(c.difficulty), `difficulty valid: ${c.text}`);
    assert.ok(c.text && words(c.text) <= 14, `text <= 14 words: "${c.text}" (${words(c.text)})`);
    assert.ok(c.why && words(c.why) <= 15, `why <= 15 words: "${c.why}" (${words(c.why)})`);
  }
});

test('no duplicate card texts across the whole bank', () => {
  const texts = allCards.map((c) => c.text);
  assert.equal(new Set(texts).size, texts.length, 'every card text is unique');
});

// --- the four required trap cards (spec §4.3) ------------------------------

test('the four required trap cards are present, correctly bucketed, and marked tricky', () => {
  const find = (re) => allCards.find((c) => re.test(c.text));
  const nh = find(/fish and timber, not faith/i);
  const nc = find(/naval stores/i);
  const tol = find(/Act of Toleration/i);
  const burg = find(/first elected assembly/i);

  assert.ok(nh && nh.region === 'ne' && nh.difficulty === 'tricky', 'New Hampshire trap -> New England');
  assert.ok(nc && nc.region === 'south' && nc.difficulty === 'tricky', 'NC naval-stores trap -> Southern');
  assert.ok(tol && tol.region === 'south' && tol.difficulty === 'tricky', 'Act of Toleration trap -> Southern (Maryland)');
  assert.ok(burg && burg.region === 'south' && burg.difficulty === 'tricky', 'first assembly trap -> Southern (Burgesses)');
});

// --- sensitivity: exactly two enslaved-labor cards, flat tone (spec §11) ----

test('exactly two cards touch enslaved labor; both flat and factual (no arcade tone)', () => {
  const serious = allCards.filter((c) => c.serious);
  assert.equal(serious.length, 2, 'exactly two serious cards');
  for (const c of serious) {
    assert.equal(c.region, 'south', 'both name Southern economics');
    assert.ok(/enslaved/i.test(c.why), 'the why names enslaved labor plainly');
    assert.ok(!/!/.test(c.why), `no exclamation on a serious why: "${c.why}"`);
  }
});

// --- the deal (spec §6, §10) ----------------------------------------------

test('dealSteps deals 30 steps, 10 per round, each from its own round pool', () => {
  const steps = dealSteps(12345);
  assert.equal(steps.length, 30);
  for (let r = 0; r < 3; r++) {
    const roundSteps = steps.filter((s) => s.round === r);
    assert.equal(roundSteps.length, CARDS_PER_ROUND, `round ${r}: 10 dealt`);
    for (const s of roundSteps) {
      assert.ok(BANK[r].includes(s.card), `round ${r} card came from round ${r}'s pool`);
    }
  }
  assert.deepEqual(steps.map((s) => s.round), [
    ...Array(10).fill(0), ...Array(10).fill(1), ...Array(10).fill(2),
  ], 'the 30 steps run round 0, then 1, then 2');
});

test('same seed -> identical deal; different seeds -> different deal', () => {
  const a = dealSteps(7).map((s) => s.card.text);
  const b = dealSteps(7).map((s) => s.card.text);
  const c = dealSteps(8).map((s) => s.card.text);
  assert.deepEqual(a, b, 'seeded deal is reproducible');
  assert.notDeepEqual(a, c, 'a different seed produces a different deal');
});

test('two fresh matches deal differently (replays differ, spec §10)', () => {
  const deckText = (state) => state.sides.class.deck.map((s) => s.card.text).join('|');
  const m1 = deckText(game.initMatch({ mode: 'solo', soloSide: 'class' }));
  const m2 = deckText(game.initMatch({ mode: 'solo', soloSide: 'class' }));
  assert.notEqual(m1, m2, 'two sessions get different deals');
});

// --- prompts never leak the answer key -------------------------------------

test('currentPrompt ships card text + buckets only — never the region or why', () => {
  const state = game.initMatch({ mode: 'solo', soloSide: 'class', seed: 1 });
  game.chapterEvent(state, 'class');
  const p = game.currentPrompt(state, 'class');
  assert.equal(p.kind, 'sort');
  assert.ok(p.card.text.length > 3);
  assert.equal(p.buckets.length, 3);
  assert.ok(!('region' in p.card), 'no region leaks');
  assert.ok(!('why' in p.card), 'no why leaks');
});

// --- playthrough helper ----------------------------------------------------

function play(seed, chooser) {
  const state = game.initMatch({ mode: 'solo', soloSide: 'class', seed });
  const resolutions = [];
  const events = [];
  for (let i = 0; i < TOTAL_ACTIONS; i++) {
    const ev = game.chapterEvent(state, 'class');
    if (ev) events.push(ev);
    const ss = state.sides.class;
    const correctIdx = BUCKET_INDEX[ss.deck[ss.cursor].card.region];
    const choiceIndex = chooser(correctIdx, i, ss);
    const res = game.resolve(state, 'class', { kind: 'sort', choiceIndex });
    assert.ok(!res.error, `step ${i}: ${res.error}`);
    resolutions.push(res);
  }
  return { state, report: game.report(state).perSide.class, resolutions, events };
}

const pickRight = (correctIdx) => correctIdx;
const pickWrong = (correctIdx) => (correctIdx + 1) % 3;

test('round-intro fires exactly once per round, at the round boundaries', () => {
  const { events } = play(2, pickRight);
  assert.equal(events.length, 3, 'three round intros');
  assert.deepEqual(events.map((e) => e.round.index), [0, 1, 2]);
  assert.equal(events[1].round.title, ROUNDS[1].title);
});

test('all-right = 100% accuracy, Gold medal, perfect round bars, no misses', () => {
  const { report } = play(99, pickRight);
  assert.equal(report.accuracy, 100);
  assert.equal(report.correct, 30);
  assert.equal(report.medal.key, 'gold');
  assert.equal(report.ending.key, 'gold');
  assert.deepEqual(report.rounds.map((r) => `${r.correct}/${r.total}`), ['10/10', '10/10', '10/10']);
  assert.equal(report.misses.length, 0);
});

test('all-wrong = 0% accuracy, no medal, and all 30 misses land in the review list', () => {
  const { report } = play(99, pickWrong);
  assert.equal(report.accuracy, 0);
  assert.equal(report.correct, 0);
  assert.equal(report.medal.key, 'none');
  assert.equal(report.misses.length, 30, 'every miss appears in the review list');
  for (const m of report.misses) {
    assert.ok(m.text && m.why && REGIONS.has(m.region) && m.regionLabel, 'each miss carries its card + why-line');
  }
});

test("a student's own misses (and only those) appear in the review list", () => {
  const missAt = new Set([3, 14, 27]);
  const { report } = play(5, (correctIdx, i) => (missAt.has(i) ? (correctIdx + 1) % 3 : correctIdx));
  assert.equal(report.misses.length, 3);
  assert.equal(report.correct, 27);
  assert.equal(report.accuracy, Math.round((27 / 30) * 100));
});

// --- accuracy is verdict-only: no speed, streak, or medal enters the grade --

test('accuracy is verdict-only — a mixed run scores exactly correct/30, nothing else', () => {
  const { report } = play(3, (correctIdx, i) => (i % 2 === 0 ? correctIdx : (correctIdx + 1) % 3));
  assert.equal(report.correct, 15);
  assert.equal(report.accuracy, 50);
  assert.equal(report.medal.key, medalFor(50).key);
});

test('resolve reports right/wrong, the correct bucket, and the serious flag', () => {
  const state = game.initMatch({ mode: 'solo', soloSide: 'class', seed: 42 });
  game.chapterEvent(state, 'class');
  const ss = state.sides.class;
  const card = ss.deck[0].card;
  const correctIdx = BUCKET_INDEX[card.region];
  const res = game.resolve(state, 'class', { kind: 'sort', choiceIndex: (correctIdx + 1) % 3 });
  assert.equal(res.verdict, 'wrong');
  assert.equal(res.correctIndex, correctIdx, 'tells the client which bucket should glow');
  assert.equal(res.correctKey, card.region);
  assert.equal(res.feedback, card.why, 'the why-line rides the resolution');
  assert.equal(res.serious, !!card.serious);
  assert.equal(typeof res.chapterDone, 'boolean');
});

test('chapterDone flips true only at the round boundaries (10th, 20th, 30th sort)', () => {
  const { resolutions } = play(1, pickRight);
  const done = resolutions.map((r, i) => (r.chapterDone ? i + 1 : null)).filter(Boolean);
  assert.deepEqual(done, [10, 20, 30], 'a round ends every 10 cards');
  assert.equal(resolutions[29].sideDone, true, 'the last sort ends the sprint');
});

test('a wrong-kind move is rejected; a bad bucket index is rejected', () => {
  const state = game.initMatch({ mode: 'solo', soloSide: 'class', seed: 1 });
  assert.equal(game.resolve(state, 'class', { kind: 'decision', choiceIndex: 0 }).error, 'wrong_step_kind');
  assert.equal(game.resolve(state, 'class', { kind: 'sort', choiceIndex: 9 }).error, 'bad_choice');
  assert.equal(game.resolve(state, 'class', { kind: 'sort', choiceIndex: -1 }).error, 'bad_choice');
});

// --- medal thresholds ------------------------------------------------------

test('medal thresholds: gold >= 90, silver >= 75, bronze >= 50, else none', () => {
  assert.equal(medalFor(100).key, 'gold');
  assert.equal(medalFor(90).key, 'gold');
  assert.equal(medalFor(89).key, 'silver');
  assert.equal(medalFor(75).key, 'silver');
  assert.equal(medalFor(74).key, 'bronze');
  assert.equal(medalFor(50).key, 'bronze');
  assert.equal(medalFor(49).key, 'none');
  assert.equal(endingFor(95).key, 'gold');
  assert.equal(endingFor(10).key, 'none');
  assert.ok(MEDALS.gold && MEDALS.silver && MEDALS.bronze && MEDALS.none);
});

// --- regional balance so all three buckets stay busy every round -----------

test('each round pool holds at least 3 of every region (buckets stay balanced)', () => {
  for (const [r, pool] of BANK.entries()) {
    const by = { ne: 0, mid: 0, south: 0 };
    for (const c of pool) by[c.region]++;
    for (const region of REGIONS) {
      assert.ok(by[region] >= 3, `round ${r}: >=3 ${region} cards (has ${by[region]})`);
    }
  }
});
