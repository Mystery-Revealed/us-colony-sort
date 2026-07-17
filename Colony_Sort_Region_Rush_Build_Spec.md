# "Colony Sort: Region Rush" — Build Specification
### Unit 1 Game · 8th Grade U.S. History · Colonization

**Purpose:** A build-ready spec to paste into Claude (Fable, Opus, Sonnet) to create the game, deploy on Render via GitHub, and embed in Wix. Shared Socket.IO engine, Teacher Command Center, standard workflow — this spec covers what's unique.

> **Reading-level rule (everything the student sees):** 8th grade content at a **5th grade reading level**. Short sentences, common words, define hard terms on first use. Does not apply to this spec itself.

> **Data method:** the **shared Socket.IO engine, solo mode** (server-authoritative, in-memory sessions, no database). One new adapter: `usColonySort.js`. Each card = one step; the three region buckets = the three choices; drag/swipe maps the chosen bucket to `choiceIndex`.

> **The design's engine:** cards fly in — "founded by William Penn," "rice and indigo plantations," "cod fishing and shipbuilding" — and students sort each into the **New England / Middle / Southern** bucket. Three themed rounds, instant one-line corrections on misses, five minutes flat. The perfect warm-up or exit ticket.

---

## 1. Game at a Glance

| Field | Value |
|---|---|
| **Title** | Colony Sort: Region Rush |
| **Unit** | 1 — Colonization |
| **TEKS** | 8.2B (reasons for founding, founders), 8.12A (regional economic patterns), 8.29B (categorizing and organizing historical information). Skills: 8.10B implicitly (geography drives the economy cards) |
| **Pick** | None — one class group |
| **Type** | Fast-paced sorting knowledge game — 3 rounds × 10 cards = **30 graded actions** |
| **Playtime** | 5–7 minutes |
| **Platform / tracking** | Shared engine solo mode; Teacher Command Center, class-wide accuracy plus per-round breakdown in the end card; session-only data |
| **Art style** | Clean card UI over Union Blue; small engraved-style icons, no scene art needed |

**One-sentence pitch:** Thirty rapid-fire colonial facts, three buckets, one skill — can you tell New England from the Middle Colonies from the South before the card lands?

**Winning vs. accuracy.** Streaks, combo flames, and the medal are **client flourishes only**; accuracy = correct sorts ÷ 30, server-side. The countdown ring creates urgency but **never auto-fails a card** — a slow right answer beats a fast wrong one, every time.

---

## 2. Historical Content Bank

The bank's raw material — every card is generated from these verified region facts.

### 2.1 Founders & foundings
| Fact | Region |
|---|---|
| William Bradford & the Pilgrims, Plymouth 1620; John Winthrop & the Puritans, Boston 1630 ("City upon a Hill") | New England |
| Roger Williams (banished → Rhode Island 1636); Anne Hutchinson (banished, followed); Thomas Hooker (Connecticut 1636; Fundamental Orders 1639); Captain John Mason (New Hampshire 1623, fishing/trading) | New England |
| Dutch West India Company (New Netherland 1624) → Duke of York (New York 1664, taken without a shot); Berkeley & Carteret (New Jersey 1664); William Penn (Pennsylvania 1681, Quaker "Holy Experiment"; Delaware acquired 1682 for sea access) | Middle |
| Virginia Company / John Smith / John Rolfe (Virginia 1607); the Calverts, Lords Baltimore (Maryland 1632, Catholic haven); Eight Lords Proprietors (Carolinas 1663, split 1712); James Oglethorpe (Georgia 1732, debtors + buffer) | Southern |

### 2.2 Economies
- **New England:** cod fishing, whaling, shipbuilding, timber from dense forests, Atlantic/triangular trade; rocky soil, short growing season.
- **Middle:** the "Breadbasket" — wheat, corn, rye; gristmills on the Hudson and Delaware; artisans, iron goods, and merchant ports (Philadelphia, New York).
- **Southern:** cash crops — tobacco (VA, MD), rice and indigo (SC, GA); the plantation system worked by enslaved labor; naval stores and small tobacco farms (NC); by 1730 enslaved people were two-thirds of South Carolina's population.

### 2.3 Reasons for founding & society
- **New England:** religious freedom for Puritans/Separatists; theocracy and town meetings; first public schools and Harvard; strict laws (Christmas banned).
- **Middle:** economic opportunity + religious tolerance; the most diverse region (English, Dutch, German, Swedish; Quakers, Lutherans, Catholics, Jews); representative assemblies.
- **Southern:** profit from cash crops; Anglican-dominated; Maryland's Act of Toleration 1649; Georgia as a fresh start for debtors and a buffer against Spanish Florida; House of Burgesses 1619.

### 2.4 Vocabulary (defined in the round-intro cards)
- **Region** — a group of colonies sharing geography and ways of life.
- **Cash crop** — grown to sell, not to eat.
- **Breadbasket** — nickname for the grain-growing Middle Colonies.
- **Toleration** — letting people worship differently than you do.

---

## 3. Core Mechanics
- **No meters** — this is a pure knowledge sprint. Progress = card count (e.g., "7/10"), a streak flame (client-only), and a per-round score recap.
- **Structure:** 3 rounds × 10 cards = **30 graded actions**. Round themes: **R1 Founders & Foundings · R2 Economies · R3 Reasons & Society.** Each run draws 10 randomly from that round's 12-card pool (order shuffled), so replays differ.
- **A card's life:** flies in from the top → hovers center with its countdown ring (12s, cosmetic) → student drags/swipes/taps it into a bucket → server verdict returns → **right:** green pulse, +streak, next card; **wrong or ring-expired-then-answered:** the correct bucket glows, the card's one-line *why* shows for 2.5s, then next card. Ring expiry alone never scores; the card waits.
- **End card:** accuracy %, per-round bars, medal (gold/silver/bronze — cosmetic, from accuracy not speed), and an auto-generated **"Review your misses"** list: every missed card with its why-line. That list is the game's real payload.

---

## 4. Reference Content — Bank Spec + Worked Samples

### 4.1 Bank spec (for Fable to fill)
**36 cards total = 3 rounds × 12.** Per round: 4 **easy** (signature facts: "cod fishing"), 5 **medium** (named people/laws: "Lord Baltimore's haven"), 3 **tricky** (deliberate traps: Maryland's *Toleration* Act sounds Middle; New Hampshire was founded for *money* in religious New England; NC's *small* farms vs. SC's plantations). Card fields: `text` (≤ 14 words), `region` (`ne|mid|south`), `why` (≤ 15 words, names the colony when the card doesn't), `difficulty`. Every fact must trace to Section 2 — no outside trivia, no invented numbers. Colony names may appear in `why` but usually not in `text` (that's the challenge).

### 4.2 Worked samples (10 — the style target)
| Round | Card text | Bucket | Why-line |
|---|---|---|---|
| R1 | "Founded by William Penn as a 'Holy Experiment'" | Middle | Pennsylvania — Penn's Quaker colony of tolerance. |
| R1 | "Its founder was banished from Massachusetts for his beliefs" | New England | Roger Williams founded Rhode Island — total religious freedom. |
| R1 | "Lord Baltimore's safe haven for English Catholics" | Southern | Maryland, 1632 — Catholic haven and tobacco colony. |
| R1 | "Taken from the Dutch in 1664 without a single shot" | Middle | New Netherland became New York — the Duke of York's prize. |
| R2 | "Cod fishing, whaling, and shipbuilding" | New England | Rocky soil pushed New Englanders to the sea. |
| R2 | "Wheat, corn, and rye — the 'Breadbasket'" | Middle | Fertile river valleys fed all thirteen colonies. |
| R2 | "Rice and indigo plantations near Charleston" | Southern | South Carolina's cash crops, worked by enslaved labor. |
| R3 | "The Act of Toleration, 1649" | Southern | Trap! That's Maryland — protecting Catholics among Protestants. |
| R3 | "Puritans built a 'City upon a Hill'" | New England | Winthrop's Massachusetts Bay — a model religious society. |
| R3 | "Founded as a fresh start for debtors — and a buffer colony" | Southern | Georgia, 1732 — Oglethorpe's two-purpose colony. |

### 4.3 Filling instructions for Fable
Complete the 36 from Section 2, hitting the difficulty quotas. Required tricky cards: Act of Toleration (R3), New Hampshire "founded for fish and timber, not faith" (R1 or R3 → NE), "small tobacco farms and naval stores" (R2 → Southern/NC), "the colonies' FIRST representative assembly" (R3 → Southern/Burgesses — students guess NE). Where slavery appears on a card ("worked by enslaved labor," "two-thirds of its people were enslaved by 1730"), the tone is flat and factual — no arcade exclamation marks on those why-lines. Keep every `text` bucket-decidable from Section 2 alone; if two regions could claim it, sharpen or cut it.

---

## 5. Screens & UI Flow
1. **Title** — navy gradient (`#1B2A4A → #10203C`), three bucket icons (⚓ / 🌾 / 🌿), START. One-screen how-to: "Drag the card home. Wrong answers teach — watch the why."
2. **Round intro** — steel-blue (`#2E74B5`) banner: round name, its vocabulary line, GO.
3. **Sort screen** — card center-stage on cool paper white (`#F5F7FA`); three buckets pinned to the bottom edge: New England (steel blue + ⚓), Middle (deep green `#2F7D4F` + 🌾), Southern (crimson `#B23A48` + 🌿) — color + icon + label always together. Countdown ring in slate; streak flame in brass gold (`#C9A227`). Drag with pointer events; tap-a-bucket works too (accessibility path); keyboard 1/2/3 supported.
4. **Miss feedback** — the correct bucket glows green; a compact navy strip shows the why-line. Misses queue for the end review.
5. **End card** — accuracy, round bars, medal, Review-your-misses list, Play Again. Teacher Command Center standard.

## 6. Engine Integration
- **Adapter:** `server/src/games/usColonySort.js` via `createStepGame`; **`gameId: 'us-colony-sort'`**; mode **solo**; no variants; **`totalActions: 30`**; no meters (`meters: {}` — verify the client meter bar hides cleanly when empty; if the factory requires meters, register a hidden dummy and flag it Opus).
- **Bank handling:** the adapter holds all 36 cards; on session start it deals each student 10 per round (seeded shuffle). Steps are the dealt cards in order; choices are always `[ne, mid, south]`; verdict `right`/`wrong` only (no partials in a 3-bucket sort); `feedback` = the why-line. **Server-side dealing is a small extension to the static-steps factory — flag for Opus** (a `dealSteps(seed)` hook; everything downstream unchanged).
- Timer, streaks, medals: client-only; the server sees only `{ choiceIndex }`.
- **Repo:** `us-colony-sort` → Render.

## 7. Visual & Audio Assets (Higgsfield MCP)
Light needs — this game is UI-first.

| # | Asset | Prompt sketch |
|---|---|---|
| 1 | Title backdrop | *Art direction standard.* "A stylized colonial Atlantic coastline at dusk viewed from the sea, three glowing regions of shoreline, painterly, cool navy palette. No text." |
| 2 | Bucket icons ×3 | Engraved-style line icons (anchor / wheat sheaf / rice-and-tobacco sprig) — generate or hand-SVG; must read at 32px. |
| 3 | Medal set | Three engraved medal badges (gold/silver/bronze) with a colonial star motif, flat style. |
| 4 | *(Optional)* round stingers | Three short UI sounds (card-land, correct chime, round-end drum); muted by default. |

## 8. Model Workflow
Standard order with these deltas — **Fable-heavy:** the 36-card bank with why-lines per §4.3 (the whole game is the bank). **Opus:** the `dealSteps` seeded-deal hook and empty-meters handling. **Sonnet:** the drag/swipe/tap/keyboard input layer and the miss-review list. Higgsfield: minimal per §7.

## 9. Teacher Command Center
Standard, one class-wide group. The PDF's Students table (Name · Status · Accuracy %) plus class accuracy; end-card round bars are per-student on screen only. Footer: **"Made for 8th Grade U.S. History · TEKS 8.2B, 8.12A, 8.29B."**

## 10. Build Checklist & Test Plan (delta)
- [ ] All 36 cards verified against Section 2; the four required trap cards present
- [ ] Every card's bucket unambiguous — two-region readings sharpened or cut
- [ ] Timer expiry never scores; slow-correct = full credit (test it)
- [ ] Streak/medal demonstrably absent from accuracy math (all-right-slow = 100%)
- [ ] Random deal differs between two sessions; same student's misses all appear in the review list
- [ ] Tap-bucket and keyboard 1/2/3 paths work; drag not required (360px + accessibility)
- [ ] Slavery-related cards use flat, factual why-lines — no arcade tone
- [ ] Palette check: zero tan/parchment; bucket color never the only signal

## 11. Teacher / Sensitivity Notes
Two bank cards touch enslaved labor because Southern economics can't be taught honestly without them. They stay in — with the arcade energy deliberately dropped on their feedback lines (no exclamation points, no streak-flame animation on those cards' why strips; a one-line client rule keyed off a `serious: true` card flag). The deeper treatment of the trade lives in the Triangular Trade Tracker; this game's job is regional classification, stated plainly.

---
*Companion to Build-a-Colony, Jamestown 1607: Survive the Starving Time, Mutiny on the Mayflower, and the Unit 1 apps. Shared engine (solo mode), Union Blue palette, same GitHub → Render → Wix workflow.*
