// usColonySort.js — Unit 1 U.S. History adapter: "Colony Sort: Region Rush"
// (SOLO, no pick, one class-wide group). A pure knowledge sprint: 3 rounds x 10
// cards = 30 graded sorts. A fact card flies in — "founded by William Penn,"
// "rice and indigo plantations," "cod fishing and shipbuilding" — and the
// student drops it into one of three fixed buckets: New England / Middle /
// Southern. Right = 1, wrong = 0 (no partials in a 3-bucket sort), server-side,
// verdict-only. Timers, streaks, combo flames, and the medal are CLIENT drama
// and never touch the grade (spec §1, §3).
//
// TWO EXTENSIONS over the static-steps factory the companion games use, both
// flagged for Opus in the spec (§6):
//   1. dealSteps(seed) — the bank holds all 36 cards; each match is dealt 10 per
//      round from that round's 12-card pool (seeded shuffle), so replays differ.
//      Steps therefore live on the per-match side-state, not as module constants.
//   2. no meters — meta.meters is {} and every meters payload is empty; the
//      client hides the meter bar cleanly. Accuracy is the only score.
//
// This adapter implements the same interface GameManager drives (initMatch,
// chapterEvent, currentPrompt, resolve, aiMove, isComplete, report, ...), so the
// shared engine is untouched. A "chapter" here is a ROUND: chapterEvent fires the
// round-intro card at each round boundary (cursor 0, 10, 20).
//
// Reading level: everything a student sees is 8th-grade content at a 5th-grade
// reading level — short sentences, common words, hard terms defined in the
// round-intro vocabulary line (spec §2.4, Common Standards §3). TEKS 8.2B, 8.12A,
// 8.29B (and 8.10B implicitly — geography drives the economy cards).
//
// SENSITIVITY (spec §11, Common Standards §10): exactly TWO cards touch enslaved
// labor, because Southern economics cannot be taught honestly without them. They
// carry `serious: true`; their why-lines are flat and factual (no exclamation
// marks), and the client drops all arcade energy on those cards — no streak
// flame, no celebration. The deeper treatment of the trade lives in the
// Triangular Trade Tracker app; this game's job is regional classification.

import { accuracyPercent } from '../scoring.js';

// ---------------------------------------------------------------------------
// The three buckets — FIXED positions. choiceIndex 0/1/2 maps here directly; a
// 3-bucket sort has no "first answer is a tell" problem, so choices are never
// shuffled (unlike the multiple-choice companion games).
// ---------------------------------------------------------------------------

export const BUCKETS = [
  { key: 'ne',    label: 'New England', icon: 'anchor' },
  { key: 'mid',   label: 'Middle',      icon: 'wheat' },
  { key: 'south', label: 'Southern',    icon: 'sprig' },
];
export const BUCKET_INDEX = { ne: 0, mid: 1, south: 2 };
export const REGION_LABEL = { ne: 'New England', mid: 'Middle', south: 'Southern' };

// ---------------------------------------------------------------------------
// The three rounds. Each opens with a themed intro card carrying its vocabulary
// line (spec §5 round intro; §2.4 vocabulary defined on first use).
// ---------------------------------------------------------------------------

export const ROUNDS = [
  {
    key: 'founders',
    title: 'Founders & Foundings',
    vocab: 'Region — a group of colonies that share geography and ways of life.',
  },
  {
    key: 'economies',
    title: 'Economies',
    vocab: 'Cash crop — a crop grown to sell, not to eat. Breadbasket — the grain-growing Middle Colonies.',
  },
  {
    key: 'society',
    title: 'Reasons & Society',
    vocab: 'Toleration — letting people worship differently than you do.',
  },
];

export const CARDS_PER_ROUND = 10;
export const POOL_PER_ROUND = 12;
export const TOTAL_ACTIONS = ROUNDS.length * CARDS_PER_ROUND; // 30

// ---------------------------------------------------------------------------
// THE BANK — 36 cards = 3 rounds x 12. Per round: 4 easy, 5 medium, 3 tricky.
// Every fact traces to the spec's Section 2 content bank; no outside trivia, no
// invented numbers. Card fields:
//   text       — the flying card, <= 14 words; the colony is usually NOT named
//                (naming it is what the `why` does — that's the challenge).
//   region     — 'ne' | 'mid' | 'south' (the one correct bucket).
//   why        — <= 15 words; names the colony when the text doesn't.
//   difficulty — 'easy' (signature facts) | 'medium' (named people/laws) |
//                'tricky' (deliberate traps).
//   serious    — true on the two enslaved-labor cards (flat tone, no arcade).
//
// The four REQUIRED trap cards (spec §4.3):
//   • New Hampshire "for fish and timber, not faith"  -> NE   (R1, tricky)
//   • "small tobacco farms and naval stores"          -> South (R2, tricky)
//   • "the Act of Toleration, 1649"                    -> South (R3, tricky)
//   • "the colonies' first elected assembly, 1619"     -> South (R3, tricky)
// ---------------------------------------------------------------------------

const BANK = [
  // ================= ROUND 1 — Founders & Foundings =================
  [
    // -- 4 easy (signature foundings) --
    { text: "Founded by William Penn as a 'Holy Experiment'", region: 'mid', difficulty: 'easy',
      why: 'Pennsylvania — Penn’s Quaker colony of tolerance.' },
    { text: 'The Pilgrims signed a compact and landed here in 1620', region: 'ne', difficulty: 'easy',
      why: 'Plymouth — William Bradford led the Pilgrims ashore.' },
    { text: "England’s first lasting colony, a tobacco settlement of 1607", region: 'south', difficulty: 'easy',
      why: 'Jamestown, Virginia — planted by the Virginia Company.' },
    { text: "James Oglethorpe’s fresh start for debtors, 1732", region: 'south', difficulty: 'easy',
      why: 'Georgia — also a buffer against Spanish Florida.' },
    // -- 5 medium (named people / laws) --
    { text: 'Its founder was banished from Massachusetts for his beliefs', region: 'ne', difficulty: 'medium',
      why: 'Roger Williams founded Rhode Island — total religious freedom.' },
    { text: "Lord Baltimore’s safe haven for English Catholics", region: 'south', difficulty: 'medium',
      why: 'Maryland, 1632 — a Catholic haven and tobacco colony.' },
    { text: 'Taken from the Dutch in 1664 without a single shot', region: 'mid', difficulty: 'medium',
      why: 'New Netherland became New York — the Duke of York’s prize.' },
    { text: "Thomas Hooker’s colony wrote the Fundamental Orders, 1639", region: 'ne', difficulty: 'medium',
      why: 'Connecticut — one of the first written plans of government.' },
    { text: 'Eight Lords Proprietors were granted this land in 1663', region: 'south', difficulty: 'medium',
      why: 'The Carolinas — later split into North and South.' },
    // -- 3 tricky (traps) --
    { text: 'Founded in 1623 for fish and timber, not faith', region: 'ne', difficulty: 'tricky',
      why: 'New Hampshire — Captain John Mason’s trading colony, still New England.' },
    { text: 'Berkeley and Carteret were handed this colony in 1664', region: 'mid', difficulty: 'tricky',
      why: 'New Jersey — carved from Dutch land beside New York.' },
    { text: "Added in 1682 to give Penn’s colony a path to the sea", region: 'mid', difficulty: 'tricky',
      why: 'Delaware — William Penn wanted ocean access.' },
  ],
  // ================= ROUND 2 — Economies =================
  [
    // -- 4 easy (signature economies) --
    { text: 'Cod fishing, whaling, and shipbuilding', region: 'ne', difficulty: 'easy',
      why: 'Rocky soil pushed New Englanders to the sea.' },
    { text: "Wheat, corn, and rye — the ‘Breadbasket’", region: 'mid', difficulty: 'easy',
      why: 'Fertile river valleys fed all thirteen colonies.' },
    { text: 'Huge tobacco plantations spread along the rivers', region: 'south', difficulty: 'easy',
      why: 'Tobacco was Virginia and Maryland’s great cash crop.' },
    { text: 'Timber and tall trees cut for building ships', region: 'ne', difficulty: 'easy',
      why: 'Dense New England forests fed the shipyards.' },
    // -- 5 medium (named goods / places) --
    { text: 'Rice and indigo plantations near Charleston', region: 'south', difficulty: 'medium', serious: true,
      why: 'South Carolina’s cash crops, worked by enslaved labor.' },
    { text: 'Gristmills grind grain along the Hudson and Delaware', region: 'mid', difficulty: 'medium',
      why: 'The Middle Colonies milled the Breadbasket’s wheat.' },
    { text: 'Busy merchant ports at Philadelphia and New York', region: 'mid', difficulty: 'medium',
      why: 'Middle Colony harbors shipped grain and goods.' },
    { text: 'Whale oil that lit lamps across the colonies', region: 'ne', difficulty: 'medium',
      why: 'New England whalers hunted the Atlantic.' },
    { text: 'Iron goods and crafts from skilled artisans', region: 'mid', difficulty: 'medium',
      why: 'Middle Colony workshops made tools and hardware.' },
    // -- 3 tricky (traps) --
    { text: 'Small tobacco farms and naval stores like tar and pitch', region: 'south', difficulty: 'tricky',
      why: 'North Carolina — smaller farms, not grand plantations.' },
    { text: 'By 1730, two-thirds of its people were enslaved', region: 'south', difficulty: 'tricky', serious: true,
      why: 'South Carolina — its rice wealth rested on enslaved labor.' },
    { text: 'Ships carried fish and rum out on the Atlantic trade', region: 'ne', difficulty: 'tricky',
      why: 'New England’s triangular trade crossed the ocean.' },
  ],
  // ================= ROUND 3 — Reasons & Society =================
  [
    // -- 4 easy (signature reasons) --
    { text: "Puritans built a ‘City upon a Hill’", region: 'ne', difficulty: 'easy',
      why: 'Winthrop’s Massachusetts Bay — a model religious society.' },
    { text: 'The most diverse mix of peoples and faiths', region: 'mid', difficulty: 'easy',
      why: 'Dutch, German, Swedish, Quaker, and Jewish settlers all lived here.' },
    { text: 'Settled for profit from cash crops', region: 'south', difficulty: 'easy',
      why: 'The Southern economy chased tobacco and rice wealth.' },
    { text: 'A fresh start for debtors, and a buffer colony', region: 'south', difficulty: 'easy',
      why: 'Georgia, 1732 — Oglethorpe’s two-purpose colony.' },
    // -- 5 medium (named systems / laws) --
    { text: 'First public schools taught children to read the Bible', region: 'ne', difficulty: 'medium',
      why: 'New England funded schools — and founded Harvard.' },
    { text: 'Town meetings let free men vote on local rules', region: 'ne', difficulty: 'medium',
      why: 'New England’s villages governed themselves directly.' },
    { text: 'Quakers, Lutherans, Catholics, and Jews all welcomed', region: 'mid', difficulty: 'medium',
      why: 'The Middle Colonies practiced real toleration.' },
    { text: 'Settlers came for economic opportunity and tolerance', region: 'mid', difficulty: 'medium',
      why: 'The Middle Colonies drew many peoples and trades.' },
    { text: 'Elected lawmakers spoke for its Dutch, German, and Quaker towns', region: 'mid', difficulty: 'medium',
      why: 'The Middle Colonies’ assemblies fit their mix of peoples.' },
    // -- 3 tricky (traps) --
    { text: 'The Act of Toleration, 1649', region: 'south', difficulty: 'tricky',
      why: 'Trap! That is Maryland — protecting Catholics among Protestants.' },
    { text: "The colonies’ first elected assembly met in 1619", region: 'south', difficulty: 'tricky',
      why: 'Virginia’s House of Burgesses — students often guess New England.' },
    { text: 'Banished believers founded it on total religious freedom', region: 'ne', difficulty: 'tricky',
      why: 'Rhode Island — Roger Williams’s colony, still New England.' },
  ],
];

// ---------------------------------------------------------------------------
// Seeded deal. mulberry32 gives a reproducible shuffle from a numeric seed, so
// tests can pin a deal while real matches get a fresh random seed each time.
// ---------------------------------------------------------------------------

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffleSeeded(arr, rnd) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Deal 10 cards from each round's 12-card pool (seeded), in shuffled order.
// Returns 30 steps: { round, card }. Same seed -> same deal (test-stable).
export function dealSteps(seed) {
  const rnd = mulberry32((seed >>> 0) || 1);
  const steps = [];
  for (let r = 0; r < ROUNDS.length; r++) {
    const picked = shuffleSeeded(BANK[r], rnd).slice(0, CARDS_PER_ROUND);
    for (const card of picked) steps.push({ round: r, card });
  }
  return steps;
}

// ---------------------------------------------------------------------------
// Medal + one-line result headline — cosmetic, from ACCURACY only (never speed).
// ---------------------------------------------------------------------------

export const MEDALS = {
  gold:   { key: 'gold',   label: 'Gold',   min: 90 },
  silver: { key: 'silver', label: 'Silver', min: 75 },
  bronze: { key: 'bronze', label: 'Bronze', min: 50 },
  none:   { key: 'none',   label: 'Keep sorting', min: 0 },
};

export function medalFor(accuracy) {
  if (accuracy >= MEDALS.gold.min) return MEDALS.gold;
  if (accuracy >= MEDALS.silver.min) return MEDALS.silver;
  if (accuracy >= MEDALS.bronze.min) return MEDALS.bronze;
  return MEDALS.none;
}

export const ENDINGS = {
  gold:   { key: 'gold',   title: 'Master Cartographer',
    text: 'You read the three regions like an old map-maker. New England, Middle, Southern — you knew each colony’s home at a glance.' },
  silver: { key: 'silver', title: 'Sharp Sorter',
    text: 'Strong work. A few facts slipped into the wrong bucket, but you clearly know how geography shaped each region.' },
  bronze: { key: 'bronze', title: 'Getting the Regions Down',
    text: 'A solid start. Look over your misses below — the traps are exactly the facts worth a second look.' },
  none:   { key: 'none',   title: 'Keep Sorting',
    text: 'The three regions take practice. Read each miss below, then play again — a fresh deal is waiting.' },
};

export function endingFor(accuracy) {
  return ENDINGS[medalFor(accuracy).key];
}

// ---------------------------------------------------------------------------
// The game object — the interface GameManager drives. Solo, no rival, no map.
// ---------------------------------------------------------------------------

const roundOf = (cursor) => Math.floor(cursor / CARDS_PER_ROUND); // 0..2 (3 at end)
const roundMeta = (r) => ({ index: r, count: ROUNDS.length, title: ROUNDS[r].title, vocab: ROUNDS[r].vocab });
const bucketList = () => BUCKETS.map((b) => ({ key: b.key, label: b.label, icon: b.icon }));

function makeSideState(seed) {
  return {
    base: 'class',       // one class-wide group; the roster/grouping key
    path: null,          // no branch
    isAI: false,
    cursor: 0,           // 0..29
    meters: {},          // no meters — accuracy is the only score
    deck: dealSteps(seed),
    actions: [],         // [{ stepIndex, verdict, points, round }]
    roundShown: -1,      // last round whose intro card was shown
  };
}

export const game = {
  id: 'us-colony-sort',
  title: 'Colony Sort: Region Rush',
  modes: ['solo'],
  sides: ['class'],      // no pick — a single class-wide group
  soloRival: false,      // pure knowledge sprint, no AI opponent
  totalActions: TOTAL_ACTIONS,
  chapterCount: ROUNDS.length,
  meta: {
    meters: {},          // empty — the client hides the meter bar
    rounds: ROUNDS.map((r) => ({ key: r.key, title: r.title, vocab: r.vocab })),
    buckets: bucketList(),
    cardsPerRound: CARDS_PER_ROUND,
    totalActions: TOTAL_ACTIONS,
  },

  // Solo only. soloSide is always 'class'. `seed` lets tests pin a deal; real
  // matches get a fresh random seed so two students never see the same deal.
  initMatch({ mode = 'solo', soloSide, seed } = {}) {
    void soloSide; // single group — nothing to pick
    const s = typeof seed === 'number' ? seed : Math.floor(Math.random() * 4294967296);
    return {
      mode: 'solo',
      map: null,
      sides: { class: makeSideState(s) },
      whoseTurn: 'class',
      chapterIndex: 0,
      status: 'active',
      winner: null,
      seed: s,
    };
  },

  // The round-intro card, once per round (cursor 0, 10, 20). Applies no toll —
  // there are no meters. Null if this round's intro was already shown.
  chapterEvent(state, side) {
    const ss = state.sides[side];
    const r = roundOf(ss.cursor);
    if (r >= ROUNDS.length || ss.roundShown >= r) return null;
    ss.roundShown = r;
    return { round: roundMeta(r), meters: {} };
  },

  // Non-mutating snapshot for a reconnecting client.
  eventSnapshot(state, side) {
    const ss = state.sides[side];
    const r = Math.min(roundOf(ss.cursor), ROUNDS.length - 1);
    return { round: roundMeta(r), meters: {} };
  },

  // What the player sees now: the card text and the three bucket labels. The
  // answer key (region/why) NEVER leaks — the client learns it only in resolve().
  currentPrompt(state, side) {
    const ss = state.sides[side];
    if (ss.cursor >= TOTAL_ACTIONS) return null;
    const step = ss.deck[ss.cursor];
    const r = roundOf(ss.cursor);
    return {
      stepIndex: ss.cursor,
      kind: 'sort',
      round: roundMeta(r),
      cardInRound: (ss.cursor % CARDS_PER_ROUND) + 1,
      cardsPerRound: CARDS_PER_ROUND,
      totalActions: TOTAL_ACTIONS,
      meters: {},
      card: { text: step.card.text, difficulty: step.card.difficulty, serious: !!step.card.serious },
      buckets: bucketList(),
    };
  },

  // Apply a submitted sort. move = { kind:'sort', choiceIndex } where choiceIndex
  // 0/1/2 is the fixed bucket (ne/mid/south). Verdict is right | wrong only.
  resolve(state, side, move) {
    const ss = state.sides[side];
    if (ss.cursor >= TOTAL_ACTIONS) return { error: 'side_done' };
    if (!move || move.kind !== 'sort') return { error: 'wrong_step_kind' };
    const idx = move.choiceIndex;
    if (!Number.isInteger(idx) || idx < 0 || idx >= BUCKETS.length) return { error: 'bad_choice' };

    const step = ss.deck[ss.cursor];
    const chosenKey = BUCKETS[idx].key;
    const correctKey = step.card.region;
    const verdict = chosenKey === correctKey ? 'right' : 'wrong';

    ss.actions.push({ stepIndex: ss.cursor, verdict, points: verdict === 'right' ? 1 : 0, round: step.round });
    ss.cursor += 1;

    return {
      side,
      kind: 'sort',
      verdict,
      feedback: step.card.why,
      chosenKey,
      correctKey,
      correctIndex: BUCKET_INDEX[correctKey],
      // Flat, factual delivery on the enslaved-labor cards — the client keys off
      // this to drop the arcade energy (no streak flame, no celebration).
      serious: !!step.card.serious,
      card: {
        text: step.card.text,
        region: correctKey,
        why: step.card.why,
        difficulty: step.card.difficulty,
        serious: !!step.card.serious,
      },
      effects: {},
      meters: {},
      round: step.round,
      stepIndex: ss.cursor - 1,
      chapterDone: ss.cursor % CARDS_PER_ROUND === 0, // a round just finished
      sideDone: ss.cursor >= TOTAL_ACTIONS,
    };
  },

  // The historically correct sort for the current card (used by tests and the
  // disconnect backfill; there is no in-game AI opponent in this solo sprint).
  aiMove(state, side) {
    const ss = state.sides[side];
    const step = ss.deck[ss.cursor];
    return { kind: 'sort', choiceIndex: BUCKET_INDEX[step.card.region] };
  },

  isComplete(state) {
    return Object.values(state.sides).every((ss) => ss.cursor >= TOTAL_ACTIONS);
  },

  // Final report — one entry per side (here just 'class'). No winner/rival in a
  // solo sprint: accuracy, the per-round breakdown, the medal, and the
  // "Review your misses" list (the game's real payload, spec §3).
  report(state) {
    const perSide = {};
    for (const side of Object.keys(state.sides)) {
      const ss = state.sides[side];
      const accuracy = accuracyPercent(ss.actions, TOTAL_ACTIONS);
      const correct = ss.actions.filter((a) => a.verdict === 'right').length;

      const rounds = ROUNDS.map((r, i) => {
        const acts = ss.actions.filter((a) => a.round === i);
        return {
          index: i,
          title: r.title,
          correct: acts.filter((a) => a.verdict === 'right').length,
          total: acts.length,
        };
      });

      const misses = ss.actions
        .filter((a) => a.verdict === 'wrong')
        .map((a) => {
          const c = ss.deck[a.stepIndex].card;
          return {
            text: c.text,
            region: c.region,
            regionLabel: REGION_LABEL[c.region],
            why: c.why,
            round: a.round,
            serious: !!c.serious,
          };
        });

      const medal = medalFor(accuracy);
      perSide[side] = {
        isAI: !!ss.isAI,
        base: ss.base,
        path: ss.path,
        variantKey: 'class',
        accuracy,
        correct,
        total: TOTAL_ACTIONS,
        rounds,
        misses,
        medal,
        ending: endingFor(accuracy),
        meters: {},
      };
    }
    return { winner: null, owners: null, perSide };
  },
};

export default game;

// Named exports for the content tests (mirrors the companion adapters' surface).
export { BANK };
