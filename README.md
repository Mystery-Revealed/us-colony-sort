# Colony Sort: Region Rush

Unit 1 · 8th Grade U.S. History · Colonization

A fast-paced sorting knowledge game: thirty colonial fact cards, three themed
rounds, one skill — telling New England, Middle, and Southern colonies apart
before the card lands. TEKS 8.2B, 8.12A, 8.29B.

Built on the shared Socket.IO game engine (solo mode, server-authoritative, no
database) with a live Teacher Command Center. Same GitHub → Render → Wix
workflow as the companion U.S. History games.

## Local development

```
npm install          # installs server/ and client/ via postinstall
npm run dev:server   # Socket.IO server on :4000
npm run dev:client   # Vite dev server on :5173 (proxies /socket.io to :4000)
```

Open `http://localhost:5173` for the student game, `#teacher` for the Command
Center.

## Tests

```
npm test
```

Runs the server test suite (`server/test/*.test.js`): bank integrity, the four
required trap cards, seeded deal reproducibility, and the GameManager solo
lifecycle.

## Build & deploy

```
npm run build         # builds client/dist
npm start              # node server/src/index.js — serves client/dist + sockets
```

One Render web service (`render.yaml`) runs the build + start commands. Embed
the deployed URL in Wix (student route on a public page; `#teacher` on a
password-protected page).

## Structure

- `server/src/games/usColonySort.js` — the adapter: 36-card bank, seeded
  per-student deal (10 cards/round), verdict-only scoring, no meters.
- `server/src/GameManager.js`, `server/src/sockets/`, `server/src/lobby/` —
  shared engine, unmodified from the companion games.
- `client/src/components/student/` — Datapad (screen flow), SortView (the
  live sprint: drag/tap/keyboard sorting), ResultScreen (accuracy, medal,
  per-round bars, miss review).
- `client/src/components/teacher/CommandCenter.jsx` — roster, approval,
  class accuracy, PDF export, end session.

Made for 8th Grade U.S. History · TEKS 8.2B, 8.12A, 8.29B
